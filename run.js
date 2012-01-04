var util = require('./lib/util');
var knode = require('./lib/knode');

var self = process.argv[2].split(':');
var port = parseInt(self[1] || 10000);
var node = new knode.KNode({ address: self[0], port: port });

if (process.argv.length >= 4) {
    var arg = process.argv[3].split(':');
    if (arg[0])
        // keep pinging the guy
        setInterval(function() {
            node.ping({ nodeID: util.nodeID(arg[0], arg[1]), address: arg[0], port: parseInt(arg[1]) });
        }, 3000);
}
