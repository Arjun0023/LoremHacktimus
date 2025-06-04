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
        
        const forwardResponse = await axios.post('http://127.0.0.1:8000/upload', forwardFormData, {
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

// New ask endpoint
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
        
        const forwardResponse = await axios.post('http://127.0.0.1:8000/ask', forwardFormData, {
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
        
        const forwardResponse = await axios.post('http://127.0.0.1:8000/summarize', {
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

module.exports = app;