# Billboard Newsletter Website

A simple billboard website for sharing prompts, pictures, and short blurbs. Integrates with LaunchDarkly's feature flags and context for real-time control.

## How to install

Clone this repository with git or download the .zip file.

```bash
# 1. Install dependencies
npm install

# 2. Update LaunchDarkly SDK key in server.js
# Replace 'YOUR_SDK_KEY_HERE' with your actual LaunchDarkly server-side SDK key

# 3. Start the server
npm start

# 4. Open http://localhost:3000 in your browser - or if you change the server.js file with a different port, open that instead.
```

## Assumptions
We are assuming you are using localhost port 3000 unless you change it in server.js. We also are assuming you already have a bash terminal, Node.js, and npm installed. We assume you have a LaunchDarkly account with the 3 features already added to your account, and a segment corralling anonymous users.

### Feature Flags

- `enable-image-uploads` - Controls image upload functionality
- `theme-selection` - Enables theme selection dropdown (light/dark mode for entire website)
- `show-feature-flag-info` - Controls visibility of the feature flag status display - perfect for development. 
