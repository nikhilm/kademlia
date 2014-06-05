var dht = require('../')
var _ = require('lodash');

var host = '127.0.0.1';




function initPeer(portNumber, seeds, onConnect) {
	var node = new dht.KNode({
		id: 'a' + portNumber,
		address: host, 
		port: portNumber, 
		streamPort: portNumber+100,
		seeds: seeds
	});
	node.on('connect', function() {
		node.set(node.self.nodeID, node.id);

		node.set('a' + node.id,'b' );
	});

    
	//console.log(node.self);

/*	if (targetPort) {
        console.log('connecting...', targetPort);
		node.connect(host, targetPort, function(err) {
			if (err) {
				console.err('CONNECT: ' + err);
				return;
			}
            console.log("Successfully connected to", targetPort);
            onConnect(node);		
		});
 	}*/
    node.debug();
}

initPeer(12004, []);

console.log('-----------');

setTimeout(function() {
	initPeer(12005, [12004], function(node) {
		
		node.set('foo', 'bar', function(err) {
            if (err) {
                console.error('set error', err);
                return;
            }
                        
            node.get('foo', function(err, data) {
                if (err) { console.error('get error', err); return; }
                console.log('get', data);
                
                //node.debug();
		    });
        });
		
	});
}, 1000);


