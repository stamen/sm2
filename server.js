"use strict";

var path = require("path");

var express = require("express"),
    LRU = require("lru-cache"),
    sando = require("sando-parser"),
    tessera = require("tessera"),
    tilelive = require("tilelive-cache")(require("tilelive"));

// TODO use tilelive-modules
require("tilelive-http")(tilelive);
require("tilelive-blend")(tilelive);
require("tilelive-solid")(tilelive);

var SOURCES = require("./sources.json"),
    CACHE = LRU(500);

var app = express();


sando.map = function(stack, callback, context) {
  var layers = [];

  stack.forEach(function(layer) {
    if (Array.isArray(layer.layers)) {
      layers = layers.concat(sando.map(layer.layers, callback));
    } else {
      layers.push(callback.call(context || stack, layer));
    }
  });

  return layers;
};

app.use("/:layers/", function(req, res, next) {
  var route;

  if (!(route = CACHE.get(req.params.layers))) {
    var layers = sando.map(sando.parse(req.params.layers), function(layer) {
      var source;

      if (layer.fill) {
        source = "solid:" + layer.fill;
      } else {
        source = SOURCES[layer.url].tiles[0]; // TODO handle url-encoded sources
      }

      return {
        source: source,
        "comp-op": layer.comp,
        opacity: layer.alpha / 100
      };
    });

    var uri = {
      protocol: "blend:",
      query: {
        layers: layers
      }
    };

    route = tessera(tilelive, {
      source: uri
    });

    CACHE.set(req.params.layers, route);
  }

  return route(req, res, next);
});

app.use("/[^\/]+/", express.static(path.join(__dirname, "node_modules/tessera/public")));
app.use("/[^\/]+/", express.static(path.join(__dirname, "node_modules/tessera/bower_components")));

app.listen(process.env.PORT || 8080, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
