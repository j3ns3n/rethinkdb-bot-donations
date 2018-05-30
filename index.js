// Set up express server for incomming webhook requests
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Snekfetch is the best HTTP module
const snek = require('snekfetch');

// Config storing configuration
const config = require('./config.json')

const dh = require('./dbHandlers/' + config.handler + '.js');
const donationHandler = new dh(config.dbsettings)

// Redirect users on the /donate endpoint to login with Discord
/*
 *  config.oauth.client_id = 'Discord application client ID'
 *  config.oauth.callback  = 'Discord callback URL'
*/
app.get('/donate', (req, res) => {
  res.redirect(301, `https://discordapp.com/api/oauth2/authorize?client_id=${config.oauth.client_id}&scope=identify&redirect_uri=${config.oauth.callback}&response_type=code`);
});

// Callback from result of /donate
app.get('/donate/callback', (req, res) => {
  /*
   *  config.oauth.client_id     = 'Discord application client ID'
   *  config.oauth.client_secret = 'Discord application client secret'
   *  req.query.code             = 'Return from /donate endpoint'
   *  config.oauth.callback      = 'Discord callback URL'
  */
  data = {
    'client_id': config.oauth.client_id,
    'client_secret': config.oauth.client_secret,
    'grant_type': 'authorization_code',
    'code': req.query.code,
    'redirect_uri': config.oauth.callback
  };
  // Get access token from code return
  snek.post('https://discordapp.com/api/oauth2/token')
  .set('Content-Type', 'application/x-www-form-urlencoded')
  .send(data)
  .then(r => {
    // Get the ID of the user that logged in with Discord
    snek.get('https://discordapp.com/api/users/@me')
    .set('Authorization', `Bearer ${r.body.access_token}`)
    .then(r => {
      // Pass to PayPal donate URL with the 'item_name' set to user's Discord ID
      /*
       * config.paypal.email = 'PayPal payment email'
      */
      res.redirect(301, `https://www.paypal.com/cgi-bin/webscr?&cmd=_donations&business=${config.paypal.email}&currency_code=USD&item_name=${r.body.id}`)
    }).catch(e => {
      res.send('Sorry about this, there was an error! Please try again.')
    });
  }).catch(e => {
    res.send('Sorry about this, there was an error! Please try again.')
  });
});

/*
 * config.port = 'Port of webserver, must be then ported in NGINX or APACHE config'
*/
app.listen(config.port, () => {
  console.log('Donation ticker listening on port ' + config.port);
});

// Accept post requests from the /donate/webhook endpoint
// ***WARNING***
// IT MAY BE A GOOD IDEA TO CHANGE THIS ENDPOINT
// BEFORE USE AS ANY POST REQUESTS SENT TO IT WILL
// BE ACCEPTED BY THE SERVER

// TODO: Add per-site keys to POST endpoint to restrict abuse
app.post('/donate/webhook', (req, res) => {
  // Check for PayPal donation characteristics
  if (req.body.payment_gross && (parseFloat(req.body.payment_gross) > 0)) {
    // Make sure donation is through the /donate endpoint
    if (req.body.item_name && (req.body.item_name.length > 0)) {
      // Pass to 'newDonor' function
      newDonor(req.body.item_name, parseFloat(req.body.payment_gross), 'donated', config.websites.paypal);
    }
  // Else if patreon characteristics are found in POST request
  } else if (req.body.data && req.body.data.relationships) {
    // Make sure pledge has Discord details
    if (req.body.included[0].attributes.social_connections && req.body.included[0].attributes.social_connections.discord && req.body.included[0].attributes.social_connections.discord.user_id) {
      // Pass to 'newDonor' function
      newDonor(req.body.included[0].attributes.social_connections.discord.user_id, parseInt(req.body.data.attributes.amount_cents) / 100, 'pledged', config.websites.patreon);
    }
  }
  // Send a 200 status to acknowledge recipt of POST request
  res.sendStatus(200);
});

const newDonor = (userid, donation, text_one, text_two) => {
  /*
   * userid = 'Discord ID'
   * donation = 'Donation amount in dollars'
   * text_one = 'pledged vs donated'
   * text_two = 'PayPal vs Patreon link'
  */
  console.log('New donation from Discord ID:',userid, 'with amount:', donation);
  snek.get('https://discordapp.com/api/users/' + userid).set('Authorization', 'Bot ' + config.bot_token).then(user => {
    user = user.body;
    snek.post(config.webhook).send({
      content: `💸 | \`${user.username}#${user.discriminator}\` just ${text_one} $${donation} over at <${text_two}>! See what benefits *you* can get by typing \`${config.donate_command}\`!`
    }).then(c => console.log(c))
  });
  donationHandler.add(userid, donation);
}
