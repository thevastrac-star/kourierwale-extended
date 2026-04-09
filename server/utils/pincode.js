const https = require('https');

/**
 * Fetch city & state for an Indian pincode.
 * Uses India Post API. Falls back to mock data on failure.
 */
exports.fetchPincodeData = (pincode) => {
  return new Promise((resolve) => {
    const url = `https://api.postalpincode.in/pincode/${pincode}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed[0] && parsed[0].Status === 'Success' && parsed[0].PostOffice && parsed[0].PostOffice.length > 0) {
            const po = parsed[0].PostOffice[0];
            resolve({ success: true, city: po.District, state: po.State, country: 'India' });
          } else {
            resolve({ success: false, message: 'Pincode not found' });
          }
        } catch (e) {
          resolve({ success: false, message: 'Parse error' });
        }
      });
    }).on('error', () => {
      resolve({ success: false, message: 'Network error' });
    });
  });
};
