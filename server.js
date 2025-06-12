require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require("path");
const sqlite3 = require('sqlite3').verbose();
const serveStatic = require("serve-static");
const { readFileSync } = require('fs');
const multer = require('multer'); // Add this for file upload handling
const { PlatformClient } = require("@gofynd/fdk-client-javascript");
const { setupFdk } = require("@gofynd/fdk-extension-javascript/express");
const { SQLiteStorage } = require("@gofynd/fdk-extension-javascript/express/storage");
const sqliteInstance = new sqlite3.Database('session_storage.db');
const productRouter = express.Router();
const FormDataLib = require('form-data'); // Rename to avoid conflicts
const axios = require('axios');
const mongoose = require('mongoose');

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for this dummy endpoint
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check file types
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
        ];
        
        const isValidType = allowedTypes.includes(file.mimetype) || 
                          file.originalname.toLowerCase().endsWith('.csv');
        
        if (isValidType) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
        }
    }
});
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dashboard_db';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,  
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Dashboard Schema
const dashboardSchema = new mongoose.Schema({
    company_id: { type: String, required: true },
    application_id: { type: String },
    dashboard_name: { type: String, required: true },
    dashboard_items: { type: Array, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const Dashboard = mongoose.model('Dashboard', dashboardSchema);
const orderSchema = new mongoose.Schema({
    company_id: { type: String, required: true },
    application_id: { type: String },
    order_id: { type: String, required: true, unique: true },
    order_created: { type: Date },
    shipment_status: { type: String },
    operational_status: { type: String },
    payment_mode: { type: String },
    user_info: {
        name: { type: String },
        mobile: { type: String },
        email: { type: String },
        gender: { type: String }
    },
    prices: {
        amount_paid: { type: Number },
        refund_amount: { type: Number },
        price_marked: { type: Number },
        discount: { type: Number },
        delivery_charge: { type: Number },
        coupon_value: { type: Number },
        price_effective: { type: Number }
    },
    total_order_value: { type: Number },
    currency: {
        currency_code: { type: String },
        currency_symbol: { type: String }
    },
    breakup_values: [{ 
        name: { type: String },
        display: { type: String },
        value: { type: String }
    }],
    shipments: [{
        shipment_id: { type: String },
        shipment_status: { type: String },
        operational_status: { type: String },
        total_bags: { type: Number },
        total_items: { type: Number },
        prices: {
            amount_paid: { type: Number },
            refund_amount: { type: Number },
            price_marked: { type: Number },
            discount: { type: Number }
        }
    }],
    raw_data: { type: Object }, // Store complete original data
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

const productSchema = new mongoose.Schema({
    company_id: { type: String, required: true },
    application_id: { type: String },
    product_uid: { type: Number, required: true },
    name: { type: String },
    slug: { type: String },
    item_code: { type: String },
    item_type: { type: String },
    brand: {
        name: { type: String },
        uid: { type: Number }
    },
    categories: [{
        uid: { type: Number },
        name: { type: String }
    }],
    price: {
        marked: {
            min: { type: Number },
            max: { type: Number },
            currency_code: { type: String },
            currency_symbol: { type: String }
        },
        effective: {
            min: { type: Number },
            max: { type: Number },
            currency_code: { type: String },
            currency_symbol: { type: String }
        }
    },
    discount: { type: String },
    sizes: [{ type: String }],
    sellable: { type: Boolean },
    country_of_origin: { type: String },
    raw_data: { type: Object }, // Store complete original data
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// Add compound index for efficient queries
productSchema.index({ company_id: 1, application_id: 1, product_uid: 1 }, { unique: true });

const Product = mongoose.model('Product', productSchema);

const fdkExtension = setupFdk({
    api_key: process.env.EXTENSION_API_KEY,
    api_secret: process.env.EXTENSION_API_SECRET,
    base_url: process.env.EXTENSION_BASE_URL,
    cluster: process.env.FP_API_DOMAIN,
    callbacks: {
        auth: async (req) => {
            // Write you code here to return initial launch url after auth process complete
            if (req.query.application_id)
                return `${req.extension.base_url}/company/${req.query['company_id']}/application/${req.query.application_id}`;
            else
                return `${req.extension.base_url}/company/${req.query['company_id']}`;
        },
        
        uninstall: async (req) => {
            // Write your code here to cleanup data related to extension
            // If task is time taking then process it async on other process.
        }
    },
    storage: new SQLiteStorage(sqliteInstance,"exapmple-fynd-platform-extension"), // add your prefix
    access_mode: "online",
    webhook_config: {
        api_path: "/api/webhook-events",
        notification_email: "useremail@example.com",
        event_map: {
            "company/product/delete": {
                "handler": (eventName) => {  console.log(eventName)},
                "version": '1'
            }
        }
    },
});

const STATIC_PATH = process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'frontend', 'public' , 'dist')
    : path.join(process.cwd(), 'frontend');
    
const app = express();
const platformApiRoutes = fdkExtension.platformApiRoutes;

// Middleware to parse cookies with a secret key
app.use(cookieParser("ext.session"));

// Middleware to parse JSON bodies with a size limit of 2mb
app.use(bodyParser.json({
    limit: '2mb'
}));

// Serve static files from the React dist directory
app.use(serveStatic(STATIC_PATH, { index: false }));

// FDK extension handler and API routes (extension launch routes)
app.use("/", fdkExtension.fdkHandler);

// Route to handle webhook events and process it.
app.post('/api/webhook-events', async function(req, res) {
    try {
      console.log(`Webhook Event: ${req.body.event} received`)
      await fdkExtension.webhookRegistry.processWebhook(req);
      return res.status(200).json({"success": true});
    } catch(err) {
      console.log(`Error Processing ${req.body.event} Webhook`);
      return res.status(500).json({"success": false});
    }
})
// Save dashboard endpoint
app.post('/api/save-dashboard', async function(req, res) {
    try {
        const { company_id, application_id, dashboard_name, dashboard_items } = req.body;

        if (!company_id || !dashboard_name || !dashboard_items) {
            return res.status(400).json({
                success: false,
                message: 'Company ID, dashboard name, and dashboard items are required'
            });
        }

        console.log('Save dashboard request received:');
        console.log('- Company ID:', company_id);
        console.log('- Application ID:', application_id);
        console.log('- Dashboard Name:', dashboard_name);
        console.log('- Items Count:', dashboard_items.length);

        // Create new dashboard
        const newDashboard = new Dashboard({
            company_id,
            application_id,
            dashboard_name,
            dashboard_items,
            created_at: new Date(),
            updated_at: new Date()
        });

        const savedDashboard = await newDashboard.save();

        return res.status(200).json({
            success: true,
            message: 'Dashboard saved successfully',
            dashboard_id: savedDashboard._id
        });

    } catch (error) {
        console.error('Save dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while saving dashboard'
        });
    }
});

// Get saved dashboards endpoint
app.get('/api/get-dashboards/:company_id', async function(req, res) {
    try {
        const { company_id } = req.params;
        const { application_id } = req.query;

        const query = { company_id };
        if (application_id) {
            query.application_id = application_id;
        }

        const dashboards = await Dashboard.find(query)
            .sort({ updated_at: -1 })
            .select('_id dashboard_name created_at updated_at dashboard_items');

        return res.status(200).json({
            success: true,
            dashboards
        });

    } catch (error) {
        console.error('Get dashboards error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching dashboards'
        });
    }
});
// Get specific dashboard by ID
app.get('/api/get-dashboard/:dashboard_id', async function(req, res) {
    try {
        const { dashboard_id } = req.params;

        const dashboard = await Dashboard.findById(dashboard_id);

        if (!dashboard) {
            return res.status(404).json({
                success: false,
                message: 'Dashboard not found'
            });
        }

        return res.status(200).json({
            success: true,
            dashboard: {
                id: dashboard._id,
                dashboard_name: dashboard.dashboard_name,
                company_id: dashboard.company_id,
                application_id: dashboard.application_id,
                dashboard_items: dashboard.dashboard_items,
                created_at: dashboard.created_at,
                updated_at: dashboard.updated_at
            }
        });

    } catch (error) {
        console.error('Get dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching dashboard'
        });
    }
});

// Delete dashboard endpoint
app.delete('/api/delete-dashboard/:dashboard_id', async function(req, res) {
    try {
        const { dashboard_id } = req.params;

        const deletedDashboard = await Dashboard.findByIdAndDelete(dashboard_id);

        if (!deletedDashboard) {
            return res.status(404).json({
                success: false,
                message: 'Dashboard not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Dashboard deleted successfully'
        });

    } catch (error) {
        console.error('Delete dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while deleting dashboard'
        });
    }
});
productRouter.get('/orders/:application_id', async function view(req, res, next) {
    try {
        const { platformClient } = req;
        const { application_id } = req.params;
        const { pageNo = 1, pageSize = 10, company_id } = req.query;

        console.log('Fetching orders for application:', application_id);
        
        // Get orders from platform API
        const orderParams = {
            pageNo: parseInt(pageNo),
            pageSize: parseInt(pageSize),
        };

        const data = await platformClient.order.getOrders(orderParams);
        
        if (data && data.items && data.items.length > 0) {
            console.log(`Processing ${data.items.length} orders for MongoDB insertion`);
            
            // Process and insert orders into MongoDB
            const ordersToInsert = [];
            const processedOrders = [];
            
            for (const orderData of data.items) {
                try {
                    // Create structured order object
                    const orderDoc = {
                        company_id: company_id || req.query.company_id || 'unknown',
                        application_id: application_id,
                        order_id: orderData.order_id,
                        order_created: orderData.order_created ? new Date(orderData.order_created) : new Date(),
                        shipment_status: orderData.shipments?.[0]?.shipment_status || 'unknown',
                        operational_status: orderData.shipments?.[0]?.operational_status || 'unknown',
                        payment_mode: orderData.payment_mode,
                        user_info: {
                            name: orderData.user_info?.name,
                            mobile: orderData.user_info?.mobile,
                            email: orderData.user_info?.email,
                            gender: orderData.user_info?.gender
                        },
                        prices: {
                            amount_paid: orderData.prices?.amount_paid || 0,
                            refund_amount: orderData.prices?.refund_amount || 0,
                            price_marked: orderData.prices?.price_marked || 0,
                            discount: orderData.prices?.discount || 0,
                            delivery_charge: orderData.prices?.delivery_charge || 0,
                            coupon_value: orderData.prices?.coupon_value || 0,
                            price_effective: orderData.prices?.price_effective || 0
                        },
                        total_order_value: orderData.total_order_value || 0,
                        currency: {
                            currency_code: orderData.currency?.currency_code || 'INR',
                            currency_symbol: orderData.currency?.currency_symbol || '₹'
                        },
                        breakup_values: orderData.breakup_values || [],
                        shipments: orderData.shipments?.map(shipment => ({
                            shipment_id: shipment.shipment_id,
                            shipment_status: shipment.shipment_status,
                            operational_status: shipment.operational_status,
                            total_bags: shipment.total_bags,
                            total_items: shipment.total_items,
                            prices: {
                                amount_paid: shipment.prices?.amount_paid || 0,
                                refund_amount: shipment.prices?.refund_amount || 0,
                                price_marked: shipment.prices?.price_marked || 0,
                                discount: shipment.prices?.discount || 0
                            }
                        })) || [],
                        raw_data: orderData, // Store complete original data
                        updated_at: new Date()
                    };

                    ordersToInsert.push(orderDoc);
                    
                    // Create flattened row for preview (similar to CSV structure)
                    const flattenedOrder = {
                        order_id: orderData.order_id,
                        order_created: orderData.order_created,
                        customer_name: orderData.user_info?.name || 'N/A',
                        customer_mobile: orderData.user_info?.mobile || 'N/A',
                        payment_mode: orderData.payment_mode || 'N/A',
                        total_amount: orderData.total_order_value || 0,
                        amount_paid: orderData.prices?.amount_paid || 0,
                        discount: orderData.prices?.discount || 0,
                        delivery_charge: orderData.prices?.delivery_charge || 0,
                        shipment_status: orderData.shipments?.[0]?.shipment_status || 'unknown',
                        operational_status: orderData.shipments?.[0]?.operational_status || 'unknown',
                        currency: orderData.currency?.currency_code || 'INR',
                        total_items: orderData.shipments?.[0]?.total_items || 0,
                        coupon_value: orderData.prices?.coupon_value || 0
                    };
                    
                    processedOrders.push(flattenedOrder);
                    
                } catch (processError) {
                    console.error('Error processing order:', orderData.order_id, processError);
                }
            }
            
            // Bulk insert/update orders in MongoDB
            if (ordersToInsert.length > 0) {
                try {
                    const bulkOps = ordersToInsert.map(order => ({
                        updateOne: {
                            filter: { order_id: order.order_id, company_id: order.company_id },
                            update: { $set: order },
                            upsert: true
                        }
                    }));
                    
                    const result = await Order.bulkWrite(bulkOps);
                    console.log(`MongoDB operation result: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
                } catch (mongoError) {
                    console.error('MongoDB insertion error:', mongoError);
                }
            }
            
            // Generate FilePreview compatible response
            const columns = [
                'order_id', 'order_created', 'customer_name', 'customer_mobile', 
                'payment_mode', 'total_amount', 'amount_paid', 'discount', 
                'delivery_charge', 'shipment_status', 'operational_status', 
                'currency', 'total_items', 'coupon_value'
            ];
            
            const previewResponse = {
                success: true,
                original_data: data, // Include original API response
                file_preview: {
                    filename: `Orders_${application_id}_${new Date().toISOString().split('T')[0]}.json`,
                    num_rows_total: processedOrders.length,
                    columns: columns,
                    first_10_rows: processedOrders.slice(0, 10),
                    insights: {
                        question: [
                            "What is the total revenue from all orders?",
                            "Which payment mode is most popular?",
                            "How many orders are in 'placed' status?",
                            "What is the average order value?",
                            "Which customers have the highest order values?",
                            "What is the total discount given across all orders?",
                            "How many orders have delivery charges?",
                            "What is the distribution of orders by shipment status?"
                        ]
                    }
                },
                mongodb_stats: {
                    total_processed: ordersToInsert.length,
                    collection_name: 'orders'
                }
            };
            
            return res.json(previewResponse);
            
        } else {
            // No orders found
            return res.json({
                success: true,
                original_data: data,
                file_preview: null,
                message: 'No orders found'
            });
        }
        
    } catch (err) {
        console.error('Get orders error:', err);
        next(err);
    }
});
// New file upload endpoint
app.post('/api/upload-file', upload.single('file'), async function(req, res) {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Get additional form data
        const company_id = req.body.company_id || req.headers['x-company-id'];
        const application_id = req.body.application_id;
        const session_id = req.body.session_id;

        // Log file details
        console.log('File received successfully:');
        console.log('- File name:', req.file.originalname);
        console.log('- File size:', req.file.size, 'bytes');
        console.log('- File type:', req.file.mimetype);
        console.log('- Company ID:', company_id);
        console.log('- Application ID:', application_id);
        console.log('- Session ID:', session_id);
        console.log('- Buffer length:', req.file.buffer.length);

        // Create FormData using the renamed import
        const forwardFormData = new FormDataLib();
        
        // Append the file buffer correctly
        forwardFormData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        
        // Only append session_id as required by the target API
        forwardFormData.append('session_id', session_id || 'session123');

        // Forward the request to the target API
        console.log('Forwarding request to http://127.0.0.1:8000/upload');
        
        const forwardResponse = await axios.post(`${AI_SERVER_URL}/upload`, forwardFormData, {
            headers: {
                ...forwardFormData.getHeaders()
                // Removed x-company-id header since target API doesn't expect it
            },
            timeout: 30000, // 30 second timeout
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // Return the response from the target API as-is
        console.log('Received response from target API:', forwardResponse.status);
        return res.status(forwardResponse.status).json(forwardResponse.data);

    } catch (error) {
        console.error('File upload/forward error:', error);
        
        // Handle multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds 10MB limit'
            });
        }
        
        if (error.message && error.message.includes('Only Excel')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed'
            });
        }

        // Handle axios/forwarding errors
        if (error.response) {
            // The target API responded with an error status
            console.error('Target API error response:', error.response.status, error.response.data);
            return res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response from target API:', error.message);
            return res.status(503).json({
                success: false,
                message: 'Target service unavailable'
            });
        } else {
            // Something else happened
            console.error('Unexpected error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during file upload'
            });
        }
    }
});

// Add this route to your server.js file after the existing /api/upload-file route
// MongoDB route endpoint with frontend conversion - Updated to support both Order and Product
app.post('/api/route-mongo', upload.none(), async function(req, res) {
    try {
        const { question, session_id, company_id, application_id, type } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                message: 'Question is required'
            });
        }

        // Validate type parameter
        const dataType = type || 'order'; // Default to 'order' for backward compatibility
        if (!['order', 'product'].includes(dataType)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "order" or "product"'
            });
        }

        console.log('MongoDB route request:', { question, session_id, company_id, application_id, type: dataType });

        // Build MongoDB query filter
        const mongoQuery = {};
        if (company_id) mongoQuery.company_id = company_id;
        if (application_id) mongoQuery.application_id = application_id;

        let sampleData = [];
        let contextText = '';
        let dbSchema = '';
        let Model = null;

        if (dataType === 'order') {
            // Fetch sample orders
            Model = Order;
            sampleData = await Order.find(mongoQuery)
                .limit(3)
                .sort({ created_at: -1 })
                .lean();

            contextText = sampleData.length > 0 
                ? `Sample Orders Data:\n${JSON.stringify(sampleData, null, 2)}`
                : 'No orders found in database for the specified criteria.';

            dbSchema = `
Orders Collection Schema:
    company_id: { type: String, required: true },
    application_id: { type: String },
    order_id: { type: String, required: true, unique: true },
    order_created: { type: Date },
    shipment_status: { type: String },
    operational_status: { type: String },
    payment_mode: { type: String },
    user_info: {
        name: { type: String },
        mobile: { type: String },
        email: { type: String },
        gender: { type: String }
    },
    prices: {
        amount_paid: { type: Number },
        refund_amount: { type: Number },
        price_marked: { type: Number },
        discount: { type: Number },
        delivery_charge: { type: Number },
        coupon_value: { type: Number },
        price_effective: { type: Number }
    },
    total_order_value: { type: Number },
    currency: {
        currency_code: { type: String },
        currency_symbol: { type: String }
    },
    breakup_values: [{ 
        name: { type: String },
        display: { type: String },
        value: { type: String }
    }],
    shipments: [{
        shipment_id: { type: String },
        shipment_status: { type: String },
        operational_status: { type: String },
        total_bags: { type: Number },
        total_items: { type: Number },
        prices: {
            amount_paid: { type: Number },
            refund_amount: { type: Number },
            price_marked: { type: Number },
            discount: { type: Number }
        }
    }],
    raw_data: { type: Object }, // Store complete original data
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }

Collection Name: orders

Common Query Examples:
- Find by status: db.orders.find({"shipment_status": "delivered"})
- Aggregate by payment: db.orders.aggregate([{$group: {_id: "$payment_mode", count: {$sum: 1}}}])
- Total revenue: db.orders.aggregate([{$group: {_id: null, total: {$sum: "$total_order_value"}}}])
- Find by customer: db.orders.find({"user_info.mobile": "1234567890"})
            `.trim();

        } else if (dataType === 'product') {
            // Fetch sample products
            Model = Product;
            sampleData = await Product.find(mongoQuery)
                .limit(3)
                .sort({ created_at: -1 })
                .lean();

            contextText = sampleData.length > 0 
                ? `Sample Products Data:\n${JSON.stringify(sampleData, null, 2)}`
                : 'No products found in database for the specified criteria.';

            dbSchema = `
Products Collection Schema:
    company_id: { type: String, required: true },
    application_id: { type: String },
    product_uid: { type: Number, required: true },
    name: { type: String },
    slug: { type: String },
    item_code: { type: String },
    item_type: { type: String },
    brand: {
        name: { type: String },
        uid: { type: Number }
    },
    categories: [{
        uid: { type: Number },
        name: { type: String }
    }],
    price: {
        marked: {
            min: { type: Number },
            max: { type: Number },
            currency_code: { type: String },
            currency_symbol: { type: String }
        },
        effective: {
            min: { type: Number },
            max: { type: Number },
            currency_code: { type: String },
            currency_symbol: { type: String }
        }
    },
    discount: { type: String },
    sizes: [{ type: String }],
    sellable: { type: Boolean },
    country_of_origin: { type: String },
    raw_data: { type: Object }, // Store complete original data
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }

Collection Name: products

Common Query Examples:
- Find by brand: db.products.find({"brand.name": "Nike"})
- Aggregate by category: db.products.aggregate([{$unwind: "$categories"}, {$group: {_id: "$categories.name", count: {$sum: 1}}}])
- Price range: db.products.find({"price.effective.min": {$gte: 100, $lte: 500}})
- Find sellable products: db.products.find({"sellable": true})
- Find by size: db.products.find({"sizes": "XL"})
            `.trim();
        }

        // Forward request to /ask-mongo endpoint
        const forwardFormData = new FormDataLib();
        forwardFormData.append('question', question.trim());
        forwardFormData.append('session_id', session_id || 'session123');
        forwardFormData.append('language', 'en-US');
        forwardFormData.append('context', contextText);
        forwardFormData.append('db_schema', dbSchema);
        //forwardFormData.append('collection_type', dataType); // Add collection type for AI context

        console.log('Forwarding to ask-mongo API...');
        
        const forwardResponse = await axios.post(`${AI_SERVER_URL}/ask-mongo`, forwardFormData, {
            headers: {
                ...forwardFormData.getHeaders()
            },
            timeout: 30000,
        });

        console.log('Received response from ask-mongo API:', forwardResponse.status, forwardResponse.data);

        // Extract the MongoDB query from the response
        const generatedQuery = forwardResponse.data.query;
        console.log('Generated MongoDB Query:', generatedQuery);

        // Execute the generated MongoDB query
        let queryResults = null;
        let queryError = null;
        let result_type = 'unknown';

        try {
            // Parse and execute the MongoDB query
            queryResults = await executeMongoQuery(generatedQuery, mongoQuery, Model);
            console.log('Query execution results:', JSON.stringify(queryResults, null, 2));

            // Determine result type based on query results
            if (Array.isArray(queryResults)) {
                if (queryResults.length > 0 && queryResults[0]._id !== undefined) {
                    result_type = 'aggregation';
                } else {
                    result_type = 'documents';
                }
            } else if (typeof queryResults === 'number') {
                result_type = 'count';
            } else {
                result_type = 'other';
            }
        } catch (execError) {
            console.error('Error executing MongoDB query:', execError);
            queryError = execError.message;
            result_type = 'error';
        }

        // Convert query results to frontend format if successful
        let frontendData = null;
        let conversionError = null;

        if (queryResults !== null && queryError === null) {
            try {
                console.log('Converting results to frontend format...');
                
                const conversionFormData = new FormDataLib();
                conversionFormData.append('query_result', JSON.stringify(queryResults));
                conversionFormData.append('question', question.trim());
                conversionFormData.append('session_id', session_id || 'session123');
                conversionFormData.append('data_type', dataType); // Add data type for better conversion

                const conversionResponse = await axios.post(`${AI_SERVER_URL}/convert-to-frontend`, conversionFormData, {
                    headers: {
                        ...conversionFormData.getHeaders()
                    },
                    timeout: 30000,
                });

                console.log('Conversion response:', conversionResponse.data);
                frontendData = conversionResponse.data.frontend_data;
                
            } catch (convError) {
                console.error('Error converting to frontend format:', convError);
                conversionError = convError.message;
                // Don't fail the entire request if conversion fails
            }
        }

        // Prepare the final response in the required format
        const responseData = {
            code: generatedQuery,
            result: frontendData || queryResults, // Use frontend data if available, otherwise raw results
            result_type: result_type,
            file_info: {
                original_filename: `mongodb_${dataType}_query_result`,
                converted_from_excel: false,
                data_type: dataType
            },
            error_fixed: queryError === null,
            original_error: queryError,
            context_info: {
                [`${dataType}s_count`]: sampleData.length,
                has_context: sampleData.length > 0,
                company_id,
                application_id,
                data_type: dataType
            },
            execution_results: {
                success: queryResults !== null,
                data: queryResults,
                error: queryError,
                executed_query: generatedQuery
            },
            frontend_conversion: {
                success: frontendData !== null,
                error: conversionError,
                converted_data: frontendData
            }
        };

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('MongoDB route error:', error);
        
        // Prepare error response in the required format
        const errorResponse = {
            code: null,
            result: null,
            result_type: 'error',
            file_info: {
                original_filename: "mongodb_query_result",
                converted_from_excel: false
            },
            error_fixed: false,
            original_error: error.message || 'Unknown error'
        };
        
        if (error.response) {
            return res.status(error.response.status).json(errorResponse);
        } else if (error.request) {
            errorResponse.original_error = 'Target service unavailable';
            return res.status(503).json(errorResponse);
        } else {
            errorResponse.original_error = 'Internal server error during MongoDB query request';
            return res.status(500).json(errorResponse);
        }
    }
});

// Updated helper function to execute MongoDB queries with dynamic model support
async function executeMongoQuery(queryString, baseFilter = {}, Model = Order) {
    try {
        // Clean the query string and handle multi-line
        let cleanQuery = queryString.trim();
        
        // Handle multi-line responses and extract the actual query
        const lines = cleanQuery.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Find the line that starts the MongoDB operation
        let startIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('find(') || lines[i].includes('aggregate(') || 
                lines[i].includes('countDocuments(') || lines[i].includes('distinct(')) {
                startIndex = i;
                break;
            }
        }
        
        let actualQuery = '';
        if (startIndex !== -1) {
            // Join all lines from the start of the operation
            actualQuery = lines.slice(startIndex).join('\n');
        } else {
            actualQuery = cleanQuery;
        }
        
        console.log('Executing query:', actualQuery);
        
        // Execute the query directly by replacing collection references with the Model
        let executableQuery = actualQuery;
        
        // Handle both orders and products collections
        if (Model.collection.collectionName === 'orders') {
            executableQuery = executableQuery.replace(/db\.orders\./g, 'Model.');
        } else if (Model.collection.collectionName === 'products') {
            executableQuery = executableQuery.replace(/db\.products\./g, 'Model.');
        }
        
        // Use Function constructor instead of eval for better multi-line support
        const asyncFunction = new Function('Model', `
            return (async () => {
                return await ${executableQuery};
            })();
        `);
        
        const result = await asyncFunction(Model);
        return result;
        
    } catch (error) {
        console.error('Error in executeMongoQuery:', error);
        throw error;
    }
}

// Add this route to your product router
productRouter.get('/sync/:application_id', async function(req, res, next) {
    try {
        const { platformClient } = req;
        const { application_id } = req.params;
        const { company_id } = req.query;

        console.log('Fetching products for application:', application_id);

        // Fetch products from platform
        const data = await platformClient.application(application_id).catalog.getAppProducts();
        
        if (data && data.items && data.items.length > 0) {
            console.log(`Processing ${data.items.length} products for MongoDB insertion`);
            
            // Process and insert products into MongoDB
            const productsToInsert = [];
            const processedProducts = [];
            
            for (const productData of data.items) {
                try {
                    // Create structured product object
                    const productDoc = {
                        company_id: company_id,
                        application_id: application_id,
                        product_uid: productData.uid,
                        name: productData.name,
                        slug: productData.slug,
                        item_code: productData.item_code,
                        item_type: productData.item_type,
                        brand: {
                            name: productData.brand?.name,
                            uid: productData.brand?.uid
                        },
                        categories: productData.categories?.map(cat => ({
                            uid: cat.uid,
                            name: cat.name
                        })) || [],
                        price: {
                            marked: {
                                min: productData.price?.marked?.min || 0,
                                max: productData.price?.marked?.max || 0,
                                currency_code: productData.price?.marked?.currency_code || 'INR',
                                currency_symbol: productData.price?.marked?.currency_symbol || '₹'
                            },
                            effective: {
                                min: productData.price?.effective?.min || 0,
                                max: productData.price?.effective?.max || 0,
                                currency_code: productData.price?.effective?.currency_code || 'INR',
                                currency_symbol: productData.price?.effective?.currency_symbol || '₹'
                            }
                        },
                        discount: productData.discount,
                        sizes: productData.sizes || [],
                        sellable: productData.sellable,
                        country_of_origin: productData.country_of_origin,
                        raw_data: productData, // Store complete original data
                        updated_at: new Date()
                    };

                    productsToInsert.push(productDoc);
                    
                    // Create flattened row for preview (similar to CSV structure)
                    const flattenedProduct = {
                        product_uid: productData.uid,
                        name: productData.name || 'N/A',
                        brand_name: productData.brand?.name || 'N/A',
                        item_code: productData.item_code || 'N/A',
                        item_type: productData.item_type || 'N/A',
                        price_min: productData.price?.effective?.min || 0,
                        price_max: productData.price?.effective?.max || 0,
                        marked_price_min: productData.price?.marked?.min || 0,
                        marked_price_max: productData.price?.marked?.max || 0,
                        discount: productData.discount || 'N/A',
                        currency: productData.price?.effective?.currency_code || 'INR',
                        sellable: productData.sellable ? 'Yes' : 'No',
                        country_of_origin: productData.country_of_origin || 'N/A',
                        categories_count: productData.categories?.length || 0,
                        sizes_count: productData.sizes?.length || 0
                    };
                    
                    processedProducts.push(flattenedProduct);
                    
                } catch (processError) {
                    console.error('Error processing product:', productData.uid, processError);
                }
            }
            
            // Bulk insert/update products in MongoDB FIRST
            let mongoResult = null;
            if (productsToInsert.length > 0) {
                try {
                    const bulkOps = productsToInsert.map(product => ({
                        updateOne: {
                            filter: { 
                                product_uid: product.product_uid, 
                                company_id: product.company_id,
                                application_id: product.application_id
                            },
                            update: { $set: product },
                            upsert: true
                        }
                    }));
                    
                    mongoResult = await Product.bulkWrite(bulkOps);
                    console.log(`MongoDB operation result: ${mongoResult.upsertedCount} inserted, ${mongoResult.modifiedCount} updated`);
                } catch (mongoError) {
                    console.error('MongoDB insertion error:', mongoError);
                    // Return error if MongoDB insertion fails
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to save products to database',
                        message: mongoError.message
                    });
                }
            }
            
            // Generate FilePreview compatible response AFTER successful MongoDB insertion
            const columns = [
                'product_uid', 'name', 'brand_name', 'item_code', 
                'item_type', 'price_min', 'price_max', 'marked_price_min', 
                'marked_price_max', 'discount', 'currency', 'sellable', 
                'country_of_origin', 'categories_count', 'sizes_count'
            ];
            
            const previewResponse = {
                success: true,
                original_data: data, // Include original API response
                file_preview: {
                    filename: `Products_${application_id}_${new Date().toISOString().split('T')[0]}.json`,
                    num_rows_total: processedProducts.length,
                    columns: columns,
                    first_10_rows: processedProducts.slice(0, 10),
                    insights: {
                        question: [
                            "What is the total number of products available?",
                            "Which brand has the most products?",
                            "What is the average price range of products?",
                            "How many products are currently sellable?",
                            "Which category has the most products?",
                            "What is the total discount value across all products?",
                            "How many products have multiple sizes available?",
                            "What is the distribution of products by country of origin?"
                        ]
                    }
                },
                mongodb_stats: {
                    total_processed: productsToInsert.length,
                    collection_name: 'products',
                    upserted_count: mongoResult?.upsertedCount || 0,
                    modified_count: mongoResult?.modifiedCount || 0
                }
            };
            
            return res.json(previewResponse);
            
        } else {
            // No products found
            return res.json({
                success: true,
                original_data: data,
                file_preview: null,
                message: 'No products found'
            });
        }
        
    } catch (err) {
        console.error('Products sync error:', err);
        next(err);
    }
});

app.post('/api/route-ask', upload.none(), async function(req, res) {
    try {
        const { question, session_id, language } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                message: 'Question is required'
            });
        }

        console.log('Ask request received:');
        console.log('- Question:', question);
        console.log('- Session ID:', session_id || 'session123');
        console.log('- Language:', language || 'en-IN');

        // Create FormData for the target API
        const forwardFormData = new FormDataLib();
        forwardFormData.append('question', question.trim());
        forwardFormData.append('session_id', session_id || 'session123');
        forwardFormData.append('language', language || 'en-IN');

        console.log('Forwarding ask request to http://127.0.0.1:8000/ask');
        
        const forwardResponse = await axios.post(`${AI_SERVER_URL}/ask`, forwardFormData, {
            headers: {
                ...forwardFormData.getHeaders()
            },
            timeout: 30000,
        });

        console.log('Received response from target API:', forwardResponse.status);
        return res.status(forwardResponse.status).json(forwardResponse.data);

    } catch (error) {
        console.error('Ask request error:', error);
        
        if (error.response) {
            console.error('Target API error response:', error.response.status, error.response.data);
            return res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            console.error('No response from target API:', error.message);
            return res.status(503).json({
                success: false,
                message: 'Target service unavailable'
            });
        } else {
            console.error('Unexpected error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during ask request'
            });
        }
    }
});
app.post('/api/route-summarize', async function(req, res) {
    try {
        const { data, question, language } = req.body;

        if (!data || !question) {
            return res.status(400).json({
                success: false,
                message: 'Data and question are required'
            });
        }

        console.log('Summarize request received:');
        console.log('- Question:', question);
        console.log('- Language:', language || 'en-IN');
        console.log('- Data keys:', Object.keys(data));

        // Forward the request to the target API as JSON
        console.log('Forwarding summarize request to http://127.0.0.1:8000/summarize');
        
        const forwardResponse = await axios.post(`${AI_SERVER_URL}/summarize`, {
            question: question,
            data: data,
            language: language || 'en-IN'
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000,
        });

        console.log('Received response from target API:', forwardResponse.status);
        return res.status(forwardResponse.status).json(forwardResponse.data);

    } catch (error) {
        console.error('Summarize request error:', error);
        
        if (error.response) {
            console.error('Target API error response:', error.response.status, error.response.data);
            return res.status(error.response.status).json(error.response.data);
        } else if (error.request) {
            console.error('No response from target API:', error.message);
            return res.status(503).json({
                success: false,
                message: 'Target service unavailable'
            });
        } else {
            console.error('Unexpected error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during summarize request'
            });
        }
    }
});
productRouter.get('/', async function view(req, res, next) {
    try {
        const {
            platformClient
        } = req;
        const data = await platformClient.catalog.getProducts()
        return res.json(data);
    } catch (err) {
        next(err);
    }
});

// Get products list for application
productRouter.get('/application/:application_id', async function view(req, res, next) {
    try {
        const {
            platformClient
        } = req;
        const { application_id } = req.params;
        const data = await platformClient.application(application_id).catalog.getAppProducts()
        return res.json(data);
    } catch (err) {
        next(err);
    }
});

// FDK extension api route which has auth middleware and FDK client instance attached to it.
platformApiRoutes.use('/products', productRouter);

// If you are adding routes outside of the /api path, 
// remember to also add a proxy rule for them in /frontend/vite.config.js
app.use('/api', platformApiRoutes);
const cleanupOrderData = async () => {
    try {
        console.log('Starting order data cleanup...');
        
        // Get count before deletion for logging
        const orderCount = await Order.countDocuments();
        console.log(`Found ${orderCount} orders to delete`);
        
        if (orderCount > 0) {
            // Delete all orders
            const deleteResult = await Order.deleteMany({});
            console.log(`Successfully deleted ${deleteResult.deletedCount} orders from MongoDB`);
        } else {
            console.log('No orders found to delete');
        }
        
        // Optional: You can also clean up dashboards if needed
        // const dashboardCount = await Dashboard.countDocuments();
        // console.log(`Found ${dashboardCount} dashboards - keeping them for persistence`);
        
    } catch (error) {
        console.error('Error during order data cleanup:', error);
    }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    try {
        // Cleanup order data
        await cleanupOrderData();
        
        // Close MongoDB connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        }
        
        // Close SQLite database
        if (sqliteInstance) {
            sqliteInstance.close((err) => {
                if (err) {
                    console.error('Error closing SQLite database:', err);
                } else {
                    console.log('SQLite database connection closed');
                }
            });
        }
        
        console.log('Graceful shutdown completed');
        process.exit(0);
        
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Register shutdown event listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restarts

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await gracefulShutdown('UNHANDLED_REJECTION');
});
// Serve the React app for all other routes
app.get('*', (req, res) => {
    return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(path.join(STATIC_PATH, "index.html")));
});

const AI_SERVER_URL = process.env.AI_SERVER_URL;
//  || 'http://127.0.0.1:8000';

module.exports = app;