var knode = require('./lib/knode');

var self = process.argv[2].split(':');
var port = parseInt(self[1] || 10000);
var node = new knode.KNode({ address: self[0], port: port });

if (process.argv.length >= 4) {
    var arg = process.argv[3].split(':');
    node.ping({ address: arg[0], port: parseInt(arg[1]) });
}
