var Service, Characteristic;
var request = require("superagent");

// Require and instantiate a cache module
var cacheModule = require("cache-service-cache-module");
var cache = new cacheModule({storage: "session", defaultExpiration: 60});

// Require superagent-cache-plugin and pass your cache module
var superagentCache = require("superagent-cache-plugin")(cache);

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-httptemperaturehumidity", "HttpTemphum", HttpTemphum);
}

function HttpTemphum(log, config) {
    this.log = log;

    // Configuration
    this.url             = config["url"];
    this.httpMethod      = config["httpMethod"] || "GET";
    this.name            = config["name"];
    this.manufacturer    = config["manufacturer"] || "Generic";
    this.model           = config["model"] || "HTTP(S)";
    this.serial          = config["serial"] || "";
    this.humidity        = config["humidity"];
    this.lastUpdateAt    = config["lastUpdateAt"] || null;
    this.cacheExpiration = config["cacheExpiration"] || 60;
}

HttpTemphum.prototype = {

    getRemoteState: function(service, callback) {
        request(this.httpMethod, this.url)
          .set("Accept", "application/json")
          .use(superagentCache)
          .expiration(this.cacheExpiration)
          .end(function(err, res, key) {
            if (err) {
                this.log(`HTTP failure (${this.url})`);
                callback(err);
            } else {
                this.log(`HTTP success (${key})`);

                this.temperatureService.setCharacteristic(
                    Characteristic.CurrentTemperature,
                    res.body.temperature
                );
                this.temperature = res.body.temperature;

                if (this.humidity !== false) {
                    this.humidityService.setCharacteristic(
                        Characteristic.CurrentRelativeHumidity,
                        res.body.humidity
                    );
                    this.humidity = res.body.humidity;
                }

                this.pm25Service.setCharacteristic(
                    Characteristic.PM2_5Density,
                    res.body.pm25
                );
                this.pm25 = res.body.pm25;

                this.co2Service.setCharacteristic(
                    Characteristic.CarbonDioxideDetected,
                    res.body.co2
                );
                this.co2 = res.body.co2;

                this.lastUpdateAt = +Date.now();

                switch (service) {
                    case "temperature":
                        callback(null, this.temperature);
                        break;
                    case "humidity":
                        callback(null, this.humidity);
                        break;
                    case "pm25":
                        callback(null, this.pm25);
                        break;
                    case "co2":
                        callback(null, this.co2);
                        break;
                    default:
                        var error = new Error("Unknown service: " + service);
                        callback(error);
                }
            }
        }.bind(this));
    },

    getTemperatureState: function(callback) {
        this.getRemoteState("temperature", callback);
    },

    getHumidityState: function(callback) {
        this.getRemoteState("humidity", callback);
    },

    getPM25State: function(callback) {
        this.getRemoteState("pm25", callback);
    },

    getCO2State: function(callback) {
        this.getRemoteState("co2", callback);
    },

    getServices: function () {
        var services = [],
            informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.SerialNumber, this.serial);
        services.push(informationService);

        this.temperatureService = new Service.TemperatureSensor(this.name);
        this.temperatureService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({ minValue: -273, maxValue: 200 })
            .on("get", this.getTemperatureState.bind(this));
        services.push(this.temperatureService);

        if (this.humidity !== false) {
            this.humidityService = new Service.HumiditySensor(this.name);
            this.humidityService
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .setProps({ minValue: 0, maxValue: 100 })
                .on("get", this.getHumidityState.bind(this));
            services.push(this.humidityService);
        }

        this.pm25Service = new Service.AirQualitySensor(this.name);
        this.pm25Service
        .getCharacteristic(Characteristic.PM2_5Density)
        .setProps({ minValue: 0, maxValue: 1000 })
        .on("get", this.getPM25State.bind(this));
        services.push(this.pm25Service);

        this.co2Service = new Service.CarbonDioxideSensor(this.name);
        this.co2Service
        .getCharacteristic(Characteristic.CarbonDioxideDetected)
        .setProps({ minValue: 0, maxValue: 2000 })
        .on("get", this.getCO2State.bind(this));
        services.push(this.co2Service);


        return services;
    }
};
