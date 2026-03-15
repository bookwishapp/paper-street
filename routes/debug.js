const express = require('express');
const router = express.Router();
const { SESClient, GetSendQuotaCommand, VerifyEmailIdentityCommand, ListVerifiedEmailAddressesCommand } = require('@aws-sdk/client-ses');
require('dotenv').config();

// GET /api/debug/ses-status - Check SES configuration and status
router.get('/api/debug/ses-status', async (req, res) => {
  const debugInfo = {
    envVars: {
      AWS_REGION: process.env.AWS_REGION ? 'SET' : 'NOT SET',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET',
      SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || 'NOT SET'
    },
    sesClient: null,
    sendQuota: null,
    verifiedEmails: null,
    error: null
  };

  try {
    // Initialize SES Client
    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    debugInfo.sesClient = {
      region: process.env.AWS_REGION || 'us-east-1',
      initialized: true
    };

    // Try to get send quota to verify credentials work
    try {
      const quotaCommand = new GetSendQuotaCommand({});
      const quotaResult = await sesClient.send(quotaCommand);
      debugInfo.sendQuota = {
        max24HourSend: quotaResult.Max24HourSend,
        maxSendRate: quotaResult.MaxSendRate,
        sentLast24Hours: quotaResult.SentLast24Hours
      };
    } catch (quotaError) {
      debugInfo.error = {
        type: 'QUOTA_ERROR',
        message: quotaError.message,
        code: quotaError.name
      };
    }

    // Try to list verified email addresses
    try {
      const listCommand = new ListVerifiedEmailAddressesCommand({});
      const listResult = await sesClient.send(listCommand);
      debugInfo.verifiedEmails = listResult.VerifiedEmailAddresses;
    } catch (listError) {
      debugInfo.verifiedEmails = {
        error: listError.message
      };
    }

  } catch (error) {
    debugInfo.error = {
      type: 'INITIALIZATION_ERROR',
      message: error.message,
      stack: error.stack
    };
  }

  res.json(debugInfo);
});

module.exports = router;