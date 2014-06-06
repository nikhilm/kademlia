var dht = require('../')
var _ = require('lodash');

var host = '127.0.0.1';
//var host = '24.131.65.218';


var peers = [];
var debug = false;

function update() {	
 	process.stdout.write('\033c');
	peers.forEach(function(p) {
		p.debug();
		console.log();
	});	
}
setInterval(update, 200);




function initPeer(portNumber, seeds, onConnect) {
	var node = new dht.KNode({
		id: 'a' + portNumber,
		address: host, 
		port: portNumber, 
	}, seeds, debug);
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
});

setTimeout(function() {
	initPeer(12005, [12004], function(node) {

		var b = false;
		setInterval(function() {
			node.set(node.id, { x: b } );
			b = !b;
		}, 325);
					
		//node.debug();
	});
}, 1000);

setTimeout(function() {
	initPeer(12006, [12005], function(node) {
		
		var b = false;
		setInterval(function() {
			node.set(node.id, { y: b } );
			b = !b;
		}, 250);
		
	});
}, 2000);

