Kademlia
==========

A Kademlia DHT implementation in node, ready to be used as
a distributed data store.

Install using `npm install kademlia`

Use:

    var dht = require('kademlia')
    var node = new dht.KNode({ address: 'IP address', port: portNumber });
    node.connect('existing peer ip', port);
    node.set('key', data);

    node.get('key', function(err, data) {
        console.log("Retrieved", data, "from DHT");
    });

API
---

### KNode

The KNode represents a Kademlia node and handles all communication and storage.
This should be the only thing you need to interact with the Kademlia overlay
network.

#### constructor(configuration)

A KNode is created by passing it an object having `address` and `port`
properties. The node will bind to `port` and start running.

    var node = new dht.KNode({ address: '10.100.98.60', port: '12345' });

#### connect(address, port)

#### get(key, callback)

#### set(key, value[, callback])

#### self

Contributors
------------

Maintainer: Nikhil Marathe <nsm.nikhil@gmail.com>
Contributors: https://github.com/nikhilm/kademlia/contributors

License
-------

Kademlia is distributed under the MIT License.
