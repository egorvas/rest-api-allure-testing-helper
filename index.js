const axios = require('axios').default;
const runtime = require('allure-mocha/runtime');
const {ContentType} = require('allure-js-commons');
const curlirize = require('axios-curlirize');
const _ = require('lodash');
const chaiJsonScheme = require('chai-json-schema');
const chai = require('chai');
chai.use(allureChaiPlugin);
chai.use(chaiJsonScheme);
curlirize(axios);

function allureChaiPlugin(chai, utils) {
    function getOverwriteMethod(name) {
        return function (_super) {
            return function (value) {
                try {
                    runtime.allure.createStep(`Expect ${utils.objDisplay(this.__flags.object)} ${name} ${value}`,
                        () => {
                            _super.apply(this, arguments);
                        })();
                } catch (e) {
                    _super.apply(this, arguments);
                }
            }
        }
    }

    const skipMethods = ["exists", "ok", "extensible", "empty", "Throw", "include", "lengthOf", "sealed", "notSealed",
        "frozen", "notFrozen"];
    const aliases = ['equals', 'eq', 'eql', 'eqls', 'above', 'gt', 'greaterThan', 'least', 'gte', 'greaterThanOrEqual',
        'below', 'lt', 'lessThan', 'most', 'lte', 'lessThanOrEqual', 'instanceof', 'haveOwnProperty',
        'haveOwnPropertyDescriptor', 'ownPropertyDescriptor', 'matches', 'matches', 'key', 'keys', 'respondsTo',
        'respondTo', 'satisfies', 'satisfy', 'members', 'decrease', 'increase', 'change', 'by', 'within', 'string'];

    Object.keys(chai.assert).concat(aliases).filter(m => {
        return skipMethods.indexOf(m) < 0
    }).forEach((func) => {
        chai.Assertion.overwriteMethod(func, getOverwriteMethod(func));
    });

}


function generateCheckFunction(axiosResponse, path, message, checks) {
    const checkObject = path === "" ? axiosResponse : _.get(axiosResponse, path);
    if (runtime.allure) {
        const stepFunction = runtime.allure.createStep(message,
            (res, body, status) => {
                checks(res, body, status);
            });
        stepFunction(chai.expect(checkObject), chai.expect(axiosResponse.data), chai.expect(axiosResponse.status));
    } else {
        return checks(chai.expect(checkObject), chai.expect(axiosResponse.data), chai.expect(axiosResponse.status));
    }
}

class Request {

    constructor(consoleOutput = true) {
        this.consoleOutput = consoleOutput;
    }

    async get(url, options, checks = {}) {
        return await request("get", url, options, this.consoleOutput, checks);
    }

    async post(url, options = {}, checks) {
        return await request("post", url, options, this.consoleOutput, checks);
    }

    async put(url, options = {}, checks) {
        return await request("put", url, options, this.consoleOutput, checks);
    }

    async delete(url, options = {}, checks) {
        return await request("delete", url, options, this.consoleOutput, checks);
    }

    async patch(url, options = {}, checks) {
        return await request("patch", url, options, this.consoleOutput, checks);
    }

    async head(url, options = {}, checks) {
        return await request("head", url, options, this.consoleOutput, checks);
    }

    async options(url, options = {}, checks) {
        return await request("options", url, options, this.consoleOutput, checks);
    }

}

async function request(method, url, options = {}, consoleOutput, checks) {
    const urlFormat = new URL(url);
    const requestFunction = async (url, options) => {
        options.url = url;
        options.method = method;
        let disableConsoleOutput = options.disableConsoleOutput ? options.disableConsoleOutput : false;
        delete options.disableConsoleOutput;
        options.curlirize = false;
        const timer = new Date();
        const response = await getResponse(options);
        if (consoleOutput && !disableConsoleOutput) {
            console.log('================REQUEST=======================');
            console.log(`Request: ${response.config.curlCommand}`)
            console.log('================RESPONSE======================');
            console.log(`Status code: ${response.status}`);
            console.log(`Body: ${JSON.stringify(response.data, null, 2)}`);
            console.log(`Response time: ${new Date() - timer} ms`);
            console.log('==============================================\n');
        }

        if (runtime.allure) {
            urlFormat.searchParams.forEach((value, key) => runtime.allure.parameter(key, value));
            runtime.allure.attachment("Request", response.config.curlCommand, ContentType.TEXT);
            runtime.allure.attachment("Response", JSON.stringify(response.data, null, 2), ContentType.JSON);
        }
        if (typeof checks === "function") {
            response.checkResponse(checks);
        }
        return response;
    };
    if (runtime.allure) {
        return await runtime.allure.createStep(`${method.toUpperCase()} ${urlFormat.origin + urlFormat.pathname}`,
            requestFunction)(url, options);
    } else {
        return await requestFunction(url, options);
    }
}

async function getResponse(options) {
    let response;
    try {
        response = await axios(options);
    } catch (error) {
        if (error.response) {
            response = error.response;
        } else {
            throw new Error(error.message);
        }
    }
    response.checkResponse = (checks, message = "Check response") =>
        generateCheckFunction(response, "", message, checks);
    response.checkField = (field, checks) =>
        generateCheckFunction(response, `data.${field}`, `Check field ${field}`, checks);
    response.checkStatus = (checks) =>
        generateCheckFunction(response, "status", "Check status code", checks);
    response.checkBody = (checks) =>
        generateCheckFunction(response, "data", "Check body", checks);
    response.checkRequest = (checks) =>
        generateCheckFunction(response, "data.request.res", "Check request", checks);
    response.checkStatusText = (checks) =>
        generateCheckFunction(response, "statusText", "Check request", checks);
    response.checkConfig = (checks) =>
        generateCheckFunction(response, "config", "Check request", checks);
    response.checkHeaders = (checks) =>
        generateCheckFunction(response, "headers", "Check request", checks);
    return response
}

module.exports = {Request, expect: chai.expect, chai};