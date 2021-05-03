const axios = require('axios').default;
const runtime = require('allure-mocha/runtime');
const {ContentType} = require('allure-js-commons');
const curlirize = require('axios-curlirize');
curlirize(axios);

class Helper {

    constructor(consoleOutput = true) {
        this.consoleOutput = consoleOutput;
    }

    async get(url, options = {}) {
        return await request("get", url, options, this.consoleOutput);
    }

    async post(url, options = {}) {
        return await request("post", url, options, this.consoleOutput);
    }

    async put(url, options = {}) {
        return await request("put", url, options, this.consoleOutput);
    }

    async delete(url, options = {}) {
        return await request("delete", url, options, this.consoleOutput);
    }

    async patch(url, options = {}) {
        return await request("patch", url, options, this.consoleOutput);
    }

    async head(url, options = {}) {
        return await request("head", url, options, this.consoleOutput);
    }

    async options(url, options = {}) {
        return await request("options", url, options);
    }

}

async function request(method, url, options = {}, consoleOutput) {
    const urlFormat = new URL(url);
    const requestFunction = async (url, options) => {
        options.url = url;
        options.method = method;
        let disableConsoleOutput = options.disableConsoleOutput ? options.disableConsoleOutput : false;
        delete options.disableConsoleOutput;
        if (consoleOutput && !disableConsoleOutput) {
            console.log('================REQUEST=======================');
        } else {
            options.curlirize = false;
        }
        const timer = new Date();
        const response = await getResponse(options);
        if (consoleOutput && !disableConsoleOutput) {
            console.log('================RESPONSE======================');
            console.log(`Status code: ${response.status}`);
            console.log(`Body: ${JSON.stringify(response.data, null, 2)}`);
            console.log(`Response time: ${new Date() - timer} ms\n`);
        }

        if (runtime.allure) {
            urlFormat.searchParams.forEach((value, key) => runtime.allure.parameter(key, value));
            runtime.allure.attachment("Request", JSON.stringify(options, null, 2), ContentType.JSON);
            runtime.allure.attachment("Response", JSON.stringify(response.data, null, 2), ContentType.JSON);
        }
        return response;
    };
    if (runtime.allure) {
        const stepFunction = runtime.allure.createStep(`${method.toUpperCase()} ${urlFormat.origin + urlFormat.pathname}`, requestFunction);
        return await stepFunction(url, options);
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
    return response
}

module.exports = Helper;