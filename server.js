const express = require('express');
const path = require('path');
const LaunchDarkly = require('launchdarkly-node-server-sdk');
const WebSocket = require('ws');

const app = express();
//change port if 3000 already in use
const PORT = 3000;

// Initialize LaunchDarkly and get your SDK key from the LaunchDarkly dashboard
const ldClient = LaunchDarkly.init(`YOUR SDK KEY`);

// Store connected WebSocket clients
const clients = new Set();

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 3001 });

wss.on('connection', (ws) => {
    console.log('Client connected for real-time updates');
    clients.add(ws);
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// Broadcast feature flag updates to all connected clients
function broadcastFlagUpdate(flags) {
    const message = JSON.stringify({ type: 'flags_update', flags });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Wait for LaunchDarkly to be ready
ldClient.on('ready', () => {
    console.log('LaunchDarkly client ready');
    
    // Set up flag change listener
    ldClient.on('update', (update) => {
        console.log('Feature flag updated:', update);
        // Get current flag values and broadcast to clients
        // Note: For WebSocket broadcasts, we use default context since we don't have specific user context
        getCurrentFlags().then(flags => {
            broadcastFlagUpdate(flags);
        }).catch(error => {
            console.warn('Error getting flags after update:', error.message);
        });
    });
});

// Function to get current flag values with device context
async function getCurrentFlags(context = null) {
    // Use provided context or create default user
    const user = context || {
        key: 'anonymous-user',
        anonymous: true
    };

    // Log billboard context for debugging
    if (context && context.billboardCode) {
        console.log(`Getting flags for billboard code ${context.billboardCode}:`, {
            billboardCode: context.billboardCode,
            anonymous: context.anonymous
        });
    } else if (context) {
        console.log('Getting flags for anonymous user');
    }

    return {
        'enable-image-uploads': await ldClient.variation('enable-image-uploads', user, false),
        'theme-selection': await ldClient.variation('theme-selection', user, false),
        'show-feature-flag-info': await ldClient.variation('show-feature-flag-info', user, true)
    };
}

// Middleware
app.use(express.json());
app.use(express.static('.'));

// LaunchDarkly feature flags endpoint
app.post('/api/flags', async (req, res) => {
    try {
        const { context } = req.body;
        const flags = await getCurrentFlags(context);
        res.json(flags);
    } catch (error) {
        console.error('LaunchDarkly error:', error);
        res.json({
            'enable-image-uploads': false,
            'theme-selection': false,
            'show-feature-flag-info': true
        });
    }
});

// Track events endpoint
app.post('/api/track', async (req, res) => {
    try {
        const { eventName, context } = req.body;
        
        // Use provided context or create default user
        const user = context || {
            key: 'anonymous-user',
            anonymous: true
        };

        // Log tracking event with billboard context
        if (context && context.billboardCode) {
            console.log(`Tracking event "${eventName}" for billboard code ${context.billboardCode}`);
        } else if (context) {
            console.log(`Tracking event "${eventName}" for anonymous user`);
        }

        await ldClient.track(eventName, user);
        res.json({ success: true });
    } catch (error) {
        console.error('Tracking error:', error);
        res.json({ success: false });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('LaunchDarkly integration ready');
});

