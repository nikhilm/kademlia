var dht = require('../')

var host = '127.0.0.1';

function initPeer(portNumber, targetPort, onConnect) {
	var node = new dht.KNode({ address: host, port: portNumber, streamPort: portNumber+100 });    
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
            onConnect(node);		
		});


 	}

	node.on('contact:add', function(c) {
		//console.log(node.self.nodeID, 'contact add', c.nodeID);
	});
	node.on('set', function(k, v, m) {
		console.log(node.self.nodeID, 'set', k, JSON.stringify(v).length + ' bytes', m.address, m.port);
	});
 
    //node.debug();
}

initPeer(12003);


setTimeout(function() {
	initPeer(12004, 12003, function(node) {
		
		node.set('x', 'a', function(err) {
            if (err) {
                console.error('set error', err);
                return;
            }

			function print() {
		        node.get('x', function(err, data) {
		            if (err) { console.error('get error', err); return; }
		            console.log('a', 'get', JSON.stringify(data).length, ' bytes');
				});
			}                        

			print();

			setTimeout(function() {
				print();
			}, 1000);
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
            if (err) {
                console.error('set error', err);
                return;
            }
                        
            node.get('x', function(err, data) {
                if (err) { console.error('get error', err); return; }
                console.log('b', 'get', JSON.stringify(data).length, ' bytes');
                
                //node.debug();
		    });
        });
		
	});
}, 1000);


