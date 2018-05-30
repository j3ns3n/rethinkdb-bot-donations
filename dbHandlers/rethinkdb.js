const rethink = require('rethinkdbdash');

class Main {
  constructor(options) {
    this.rethink = rethink({
      silent: true,
      host: options.host || '127.0.0.1',
      port: options.port || 28105,
      db: options.db || 'donations',
      user: options.user || 'admin',
      password: options.password || ''
    });
    this.table = options.table || 'donators';
  }

  add(userid, donation) {
    this.rethink.table(this.table).get(userid).run((err, user) => {
      if (err) return console.error(err.stack);
      if (!user) {
        this.rethink.table(this.table).insert({id: userid, amount: donation}).run((err, cb) => {
          if (err) return console.error(err.stack);
          return;
        });
      } else {
        this.rethink.table(this.table\).get(userid).update({
          amount: parseFloat(parseFloat(user.amount + donation).toFixed(2))
        }).run((err) => {
          if (err) return console.error(err.stack);
        });
      }
    });
  }

}
