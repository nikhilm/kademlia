var dht = require('../')
var _ = require('lodash');

var host = '127.0.0.1';


var peers = [];

function update() {	
 	process.stdout.write('\033c');
	peers.forEach(function(p) {
		p.debug();
		console.log();
	});
	
}




function initPeer(portNumber, seeds, onConnect) {
	var node = new dht.KNode({
		id: 'a' + portNumber,
		address: host, 
		port: portNumber, 
		streamPort: portNumber+100,
		seeds: seeds
	});
	node.once('contact:add', function() {
		onConnect(node);
	});
	peers.push(node);

    
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
    //node.debug();
}

initPeer(12004, [], function(node) {
	setTimeout(function() {
		node.debug();
	}, 3000);
});

setTimeout(function() {
	initPeer(12005, [12004], function(node) {
		//node.set(node.self.nodeID, node.id);

		node.set('a' + node.id,'b' );
		node.debug();
	});
}, 1000);


setInterval(update, 100);
