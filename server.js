require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require("path");
const sqlite3 = require('sqlite3').verbose();
const serveStatic = require("serve-static");
const { readFileSync } = require('fs');
const multer = require('multer'); // Add this for file upload handling
const { setupFdk } = require("@gofynd/fdk-extension-javascript/express");
const { SQLiteStorage } = require("@gofynd/fdk-extension-javascript/express/storage");
const sqliteInstance = new sqlite3.Database('session_storage.db');
const productRouter = express.Router();
const FormDataLib = require('form-data'); // Rename to avoid conflicts
const axios = require('axios');

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

// Serve the React app for all other routes
app.get('*', (req, res) => {
    return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(path.join(STATIC_PATH, "index.html")));
});

module.exports = app;