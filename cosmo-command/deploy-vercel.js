const fs = require('fs');
const path = require('path');
const https = require('https');

// Create a simple deployment package
const buildDir = path.join(__dirname, 'build');

// Read all files in build directory
function getFiles(dir, basePath = '') {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.join(basePath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getFiles(fullPath, relativePath));
    } else {
      files.push({
        path: relativePath,
        content: fs.readFileSync(fullPath, 'base64'),
        encoding: 'base64'
      });
    }
  }
  
  return files;
}

const files = getFiles(buildDir);
console.log(`Found ${files.length} files to deploy`);

// Deploy to Vercel
const deployData = JSON.stringify({
  name: 'cosmo-command-mobile',
  files: files,
  framework: 'create-react-app'
});

const options = {
  hostname: 'api.vercel.com',
  path: '/v13/deployments',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(deployData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Deploy response:', JSON.stringify(response, null, 2));
      if (response.url) {
        console.log('\n✅ Deployed successfully!');
        console.log('🔗 URL:', response.url);
      } else if (response.error) {
        console.log('\n❌ Error:', response.error.message || response.error);
      }
    } catch (e) {
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Deploy failed:', e.message);
});

req.write(deployData);
req.end();
