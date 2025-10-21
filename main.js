/**
 * Billboard Newsletter Application
 * Simple frontend that calls Node.js backend for LaunchDarkly
 */

// Global variables
let currentCode = null;
let featureFlags = {};
let contentData = JSON.parse(localStorage.getItem('billboardContent') || '{}');
let ws = null;
// Create LaunchDarkly user context based on billboard code
function createUserContext() {
    // Create a unique user key based on billboard code
    const userKey = currentCode ? `billboard-${currentCode}` : `anonymous`;
    
    const context = {
        key: userKey,
        anonymous: !currentCode, // Not anonymous if we have a billboard code
        // Billboard-specific attributes
        billboardCode: currentCode,
        timestamp: Date.now(),
    };
    
    console.log('Created LaunchDarkly context:', context);
    return context;
}

// Connect to WebSocket for real-time updates
function connectWebSocket() {
    try {
        ws = new WebSocket('ws://localhost:3001');
        
        ws.onopen = () => {
            console.log('Connected to real-time updates');
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'flags_update') {
                console.log('Received feature flag update:', data.flags);
                featureFlags = data.flags;
                updateFeatureFlagDisplay();
                // Show notification that flags were updated
                showFlagUpdateNotification();
            }
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected, attempting to reconnect...');
            // Reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        // Polling if WebSocket fails
        startPolling();
    }
}

// Fallback polling mechanism
function startPolling() {
    console.log('Using polling fallback for feature flag updates');
    setInterval(async () => {
        try {
            const response = await fetch('/api/flags');
            const newFlags = await response.json();
            
            // Check if flags have changed
            if (JSON.stringify(newFlags) !== JSON.stringify(featureFlags)) {
                console.log('Feature flags changed via polling:', newFlags);
                featureFlags = newFlags;
                updateFeatureFlagDisplay();
                showFlagUpdateNotification();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 5000); // Poll every 5 seconds
}

// Show notification when flags are updated - only if the show-feature-flag-info flag is true
function showFlagUpdateNotification() {
    // Only show notification if the show-feature-flag-info flag is enabled
    if (!featureFlags['show-feature-flag-info']) {
        return;
    }
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    notification.textContent = '🔄 Feature flags updated!';
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Load feature flags from Node.js backend
async function loadFeatureFlags() {
    try {
        // Create billboard context
        const billboardContext = createUserContext();
        
        // Send billboard context to backend
        const response = await fetch('/api/flags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ context: billboardContext })
        });
        
        featureFlags = await response.json();
        updateFeatureFlagDisplay();
        console.log('Feature flags loaded for billboard:', billboardContext.billboardCode || 'anonymous', featureFlags);
    } catch (error) {
        console.error('Failed to load feature flags:', error);
        // Use default values if API fails
        featureFlags = {
            'enable-image-uploads': false,
            'theme-selection': false,
            'show-feature-flag-info': true
        };
        updateFeatureFlagDisplay();
    }
}

// Track events via Node.js backend
async function trackEvent(eventName) {
    try {
        // Create billboard context
        const billboardContext = createUserContext();
        
        await fetch('/api/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                eventName: eventName,
                context: billboardContext
            })
        });
    } catch (error) {
        console.error('Failed to track event:', error);
    }
}

// Update feature flag display
function updateFeatureFlagDisplay() {
    const flags = [];
    
    if (featureFlags['enable-image-uploads']) {
        flags.push('Image Uploads: Enabled');
    }
    
    if (featureFlags['theme-selection']) {
        flags.push('Theme Selection: Enabled');
    }

    document.getElementById('featureFlagsStatus').textContent = 
        flags.length > 0 ? flags.join(', ') : 'No active flags';
    
    // Update UI based on feature flags
    updateUIForFeatureFlags();
    
    // Show/hide feature flag info section based on flag
    updateFeatureFlagInfoVisibility();
}

// Get display name for font selection
function getFontDisplayName(fontValue) {
    const fontMap = {
        'arial': 'Arial',
        'comic-sans': 'Comic Sans MS',
        'times-new-roman': 'Times New Roman',
        'papyrus': 'Papyrus',
        'georgia': 'Georgia'
    };
    return fontMap[fontValue] || 'Arial';
}

// Update UI elements based on current feature flags
// This dynamically shows/hides the Picture option and Font selection based on feature flags
function updateUIForFeatureFlags() {
    const contentTypeSelect = document.getElementById('contentType');
    const pictureOption = contentTypeSelect.querySelector('option[value="picture"]');
    
    if (featureFlags['enable-image-uploads']) {
        // Show picture option if it doesn't exist
        if (!pictureOption) {
            const newOption = document.createElement('option');
            newOption.value = 'picture';
            newOption.textContent = 'Picture';
            contentTypeSelect.appendChild(newOption);
        }
    } else {
        // Hide picture option if image uploads are disabled
        if (pictureOption) {
            pictureOption.remove();
        }
        
        // If picture was selected, switch to prompt and notify user
        if (contentTypeSelect.value === 'picture') {
            contentTypeSelect.value = 'prompt';
            // Show notification that content type was changed
            showContentTypeChangeNotification();
        }
    }
    
    // Always update image group visibility based on current selection and feature flag
    updateImageGroupVisibility();
    
    // Update font selection visibility
        updateThemeSelectionVisibility();
}

// Update image group visibility based on content type and feature flag
function updateImageGroupVisibility() {
    const contentTypeSelect = document.getElementById('contentType');
    const imageGroup = document.getElementById('imageGroup');
    
    if (contentTypeSelect.value === 'picture' && featureFlags['enable-image-uploads']) {
        imageGroup.style.display = 'block';
    } else {
        imageGroup.style.display = 'none';
    }
}

// Update feature flag info section visibility based on show-feature-flag-info flag
function updateFeatureFlagInfoVisibility() {
    const featureFlagInfo = document.getElementById('featureFlagInfo');
    
    if (featureFlags['show-feature-flag-info']) {
        featureFlagInfo.style.display = 'block';
    } else {
        featureFlagInfo.style.display = 'none';
    }
}

// Update theme selection visibility based on theme-selection flag
function updateThemeSelectionVisibility() {
    const headerThemeSelector = document.getElementById('headerThemeSelector');
    
    if (featureFlags['theme-selection']) {
        headerThemeSelector.style.display = 'flex';
    } else {
        headerThemeSelector.style.display = 'none';
    }
}

// Show notification when content type is automatically changed due to feature flag
function showContentTypeChangeNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ffc107;
        color: #212529;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        max-width: 300px;
    `;
    notification.innerHTML = '⚠️ Image uploads disabled - switched to Prompt';
    document.body.appendChild(notification);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

// Generate a new 4-digit code
function generateNewCode() {
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    currentCode = newCode;
    document.getElementById('accessCode').value = newCode;
    document.getElementById('authMessage').innerHTML = 
        '<div class="success">New code generated: ' + newCode + '</div>';
    
    // Store the code in localStorage
    localStorage.setItem('billboardCode', newCode);
    
    // Refresh feature flags for the new billboard code
    loadFeatureFlags();
}

// Authenticate with 4-digit code
function authenticate() {
    const inputCode = document.getElementById('accessCode').value;
    
    if (inputCode.length !== 4 || !/^\d{4}$/.test(inputCode)) {
        document.getElementById('authMessage').innerHTML = 
            '<div class="error">Please enter a valid 4-digit code</div>';
        return;
    }

    // Check if code exists in localStorage or create new billboard
    if (!contentData[inputCode]) {
        contentData[inputCode] = [];
        localStorage.setItem('billboardContent', JSON.stringify(contentData));
    }

    currentCode = inputCode;
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('billboardContent').style.display = 'block';
    
    loadContent();
    
    // Refresh feature flags for the accessed billboard code
    loadFeatureFlags();
    
    // Track authentication event
    trackEvent('user_authenticated');
}

// Load content for current code
function loadContent() {
    const contentGrid = document.getElementById('contentGrid');
    contentGrid.innerHTML = '';

    const posts = contentData[currentCode] || [];
    
    if (posts.length === 0) {
        contentGrid.innerHTML = '<p>No content posted yet. Be the first to share something!</p>';
        return;
    }

    posts.forEach((post, index) => {
        const contentItem = document.createElement('div');
        contentItem.className = 'content-item';
        
        
        let contentHtml = `
            <h3>${post.title}</h3>
            <p><strong>Type:</strong> ${post.type}</p>
            <p><strong>Posted:</strong> ${new Date(post.timestamp).toLocaleString()}</p>
        `;
        
        if (post.type === 'picture' && post.imageUrl) {
            contentHtml += `<img src="${post.imageUrl}" alt="${post.title}" onerror="this.style.display='none'">`;
        }
        
        if (post.content) {
            contentHtml += `<p>${post.content}</p>`;
        }
        
        contentItem.innerHTML = contentHtml;
        contentGrid.appendChild(contentItem);
    });
}

// Post new content
function postContent() {
    const type = document.getElementById('contentType').value;
    const title = document.getElementById('contentTitle').value.trim();
    const content = document.getElementById('contentText').value.trim();
    const imageUrl = document.getElementById('contentImage').value.trim();

    if (!title || !content) {
        document.getElementById('postMessage').innerHTML = 
            '<div class="error">Please fill in title and content</div>';
        return;
    }

    if (type === 'picture' && !imageUrl) {
        document.getElementById('postMessage').innerHTML = 
            '<div class="error">Please provide an image URL for picture posts</div>';
        return;
    }

    const newPost = {
        type: type,
        title: title,
        content: content,
        imageUrl: imageUrl,
        timestamp: Date.now()
    };

    if (!contentData[currentCode]) {
        contentData[currentCode] = [];
    }

    contentData[currentCode].push(newPost);
    localStorage.setItem('billboardContent', JSON.stringify(contentData));

    // Clear form
    document.getElementById('contentTitle').value = '';
    document.getElementById('contentText').value = '';
    document.getElementById('contentImage').value = '';

    document.getElementById('postMessage').innerHTML = 
        '<div class="success">Content posted successfully!</div>';

    loadContent();
    
    // Track content posting event
    trackEvent('content_posted');
}

// Logout
function logout() {
    currentCode = null;
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('billboardContent').style.display = 'none';
    document.getElementById('accessCode').value = '';
    document.getElementById('authMessage').innerHTML = '';
    document.getElementById('postMessage').innerHTML = '';
    
    // Refresh feature flags for anonymous user
    loadFeatureFlags();
    
    // Track logout event
    trackEvent('user_logged_out');
}

// Apply theme to the website
function applyTheme(theme) {
    const body = document.body;
    const themeSelect = document.getElementById('themeSelect');
    
    // Remove existing theme classes
    body.classList.remove('light-theme', 'dark-theme');
    
    // Apply new theme
    if (theme === 'dark') {
        body.classList.add('dark-theme');
    } else {
        body.classList.add('light-theme');
    }
    
    // Update theme selector dropdown
    if (themeSelect) {
        themeSelect.value = theme;
    }
    
    // Store theme preference
    localStorage.setItem('selectedTheme', theme);
    
    console.log('Applied theme:', theme);
}

// Show/hide image input based on content type
function setupEventListeners() {
    document.getElementById('contentType').addEventListener('change', function() {
        // Prevent selecting picture if image uploads are disabled
        if (this.value === 'picture' && !featureFlags['enable-image-uploads']) {
            this.value = 'prompt';
            showContentTypeChangeNotification();
            return;
        }
        
        // Update image group visibility
        updateImageGroupVisibility();
    });
    
    // Theme selection event listener
    document.getElementById('themeSelect').addEventListener('change', function() {
        applyTheme(this.value);
    });
}

// Initialize application
window.addEventListener('load', async function() {
    // Check if there's a saved code
    const savedCode = localStorage.getItem('billboardCode');
    if (savedCode) {
        document.getElementById('accessCode').value = savedCode;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    applyTheme(savedTheme);
    
    // Load initial feature flags from Node.js backend
    await loadFeatureFlags();
    
    // Connect to WebSocket for real-time updates
    connectWebSocket();
    
    // Track app initialization
    trackEvent('app_initialized');
});