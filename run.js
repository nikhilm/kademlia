var net = require('net');

var util = require('./lib/util');
var knode = require('./lib/knode');

var self = process.argv[2].split(':');
var port = parseInt(self[1] || 10000);
var node = new knode.KNode({ address: self[0], port: port });

if (process.argv.length >= 4) {
    var arg = process.argv[3].split(':');
    if (arg[0])
        node.connect(arg[0], parseInt(arg[1]), function(err) {
            console.log(err);
            process.exit(1);
        });
}

// 'interactive' console
var cmd = function(stream) {
    stream.setEncoding('utf8');
    stream.on('data', function(data) {
        var parts = data.trim().split(' ');
        switch (parts[0]) {
            case 'set':
                if (parts.length < 3) {
                    stream.write("Not enough parameters\n");
                    break;
                }
                node.set(parts[1], parts[2], function(err) {
                    if (err)
                        stream.write("Error setting " + parts[1] + ": " + JSON.stringify(err) + "\n");
                    else
                        stream.write("Set " + parts[1] + " to " + parts[2] + "\n");
                });
                break;

            case 'get':
                if (parts.length < 2) {
                    stream.write("Not enough parameters\n");
                    break;
                }
                node.get(parts[1], function(err, val) {
                    if (err)
                        stream.write("Error getting " + parts[1] + ": " + JSON.stringify(err) + "\n");
                    else
                        stream.write("Value of " + parts[1] + " is " + val + "\n");
                });
                break;

            case 'info':
                node.debug();
                break;

            default:
                stream.write("Unknown command\n");
        }
    });
}

process.stdin.resume()
cmd(process.stdin)
net.createServer(function(socket) {
    cmd(socket)
}).listen(port);
