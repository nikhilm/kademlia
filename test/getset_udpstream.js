var dht = require('../')

var host = '127.0.0.1';

function initPeer(portNumber, targetPort, onConnect) {
	var node = new dht.KNode({ id:('a'+portNumber), address: host, port: portNumber, streamPort: portNumber+100 },[],true);
    node.know(['x']);

	console.log(node.self);
	if (targetPort) {
        console.log('connecting...', targetPort);
		node.connect(host, targetPort, function(err) {
			if (err) {
				console.err('CONNECT: ' + err);
				return;
			}
            console.log("Successfully connected to", targetPort);
		});


 	}
	node.once('contact:add', function() {
		if (onConnect)
			onConnect(node);		
	});
 
    //node.debug();
}

initPeer(12003);


setTimeout(function() {
	initPeer(12004, 12003, function(node) {
		
		node.set('x', 'a', function(err) {
            if (err) { console.error('set error', err); return; }

			node.get('x');			
			node.once('set:x', function(v) {
				console.log('a', 'get', JSON.stringify(v).length, ' bytes');
			});

        });
		
	});
}, 500);



console.log('-----------');

setTimeout(function() {
	initPeer(12005, 12003, function(node) {
		
		var largeObject = [];
		for (var i = 0; i < 8000; i++) {
			largeObject.push('x'+i);
		}
		console.log('large obj size: ', JSON.stringify(largeObject).length);

		node.set('x', largeObject, function(err) {
            if (err) { console.error('set error', err); return; }
                        
            node.get('x');
			node.once('set:x', function(v, m) {
				console.log('b', 'set', JSON.stringify(v).length, 'bytes');
			});
        });
		
	});
}, 1000);


