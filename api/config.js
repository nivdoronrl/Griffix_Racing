export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    paypalMeUrl: process.env.PAYPAL_ME_URL || 'https://www.paypal.com/paypalme/GriffixRacing',
    zelleContact: process.env.ZELLE_CONTACT || 'payments@griffixracing.com',
    currency: 'USD',
  });
}
