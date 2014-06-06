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
	}, seeds);
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

		node.set('a' + node.id, { x: 'y' } );
		node.debug();
	});
}, 1000);

setTimeout(function() {
	initPeer(12006, [12005], function(node) {
		setTimeout(function() {
			node.get('aa12005', function(err, v) {
				console.log(node.id + ' got ' + JSON.stringify(v));
				node.debug();
			}, true);
		}, 3000);
	});
}, 2000);

//setInterval(update, 200);
