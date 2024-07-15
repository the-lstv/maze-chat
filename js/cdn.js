function LSCDN(endpoint = "https://cdn-origin.extragon.cloud"){
    return new((_this => class {
        constructor(){
            _this = this;

            this.endpoint = endpoint;
            
            /**
             * [js-md5]{@link https://github.com/emn178/js-md5}
             *
             * @namespace md5
             * @version 0.8.0
             * @author Chen, Yi-Cyuan [emn178@gmail.com]
             * @copyright Chen, Yi-Cyuan 2014-2023
             * @license MIT
            */
            !function(){"use strict";function t(t){if(t)b[0]=b[16]=b[1]=b[2]=b[3]=b[4]=b[5]=b[6]=b[7]=b[8]=b[9]=b[10]=b[11]=b[12]=b[13]=b[14]=b[15]=0,this.blocks=b,this.buffer8=a;else if(u){var r=new ArrayBuffer(68);this.buffer8=new Uint8Array(r),this.blocks=new Uint32Array(r)}else this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];this.h0=this.h1=this.h2=this.h3=this.start=this.bytes=this.hBytes=0,this.finalized=this.hashed=!1,this.first=!0}function r(r,e){var i,s=_(r);if(r=s[0],s[1]){var h,n=[],a=r.length,o=0;for(i=0;i<a;++i)(h=r.charCodeAt(i))<128?n[o++]=h:h<2048?(n[o++]=192|h>>>6,n[o++]=128|63&h):h<55296||h>=57344?(n[o++]=224|h>>>12,n[o++]=128|h>>>6&63,n[o++]=128|63&h):(h=65536+((1023&h)<<10|1023&r.charCodeAt(++i)),n[o++]=240|h>>>18,n[o++]=128|h>>>12&63,n[o++]=128|h>>>6&63,n[o++]=128|63&h);r=n}r.length>64&&(r=new t(!0).update(r).array());var f=[],u=[];for(i=0;i<64;++i){var c=r[i]||0;f[i]=92^c,u[i]=54^c}t.call(this,e),this.update(u),this.oKeyPad=f,this.inner=!0,this.sharedMemory=e}var e="input is invalid type",i="object"==typeof window,s=i?window:{};s.JS_MD5_NO_WINDOW&&(i=!1);var h=!i&&"object"==typeof self,n=!s.JS_MD5_NO_NODE_JS&&"object"==typeof process&&process.versions&&process.versions.node;n?s=global:h&&(s=self);var a,o=!s.JS_MD5_NO_COMMON_JS&&"object"==typeof module&&module.exports,f="function"==typeof define&&define.amd,u=!s.JS_MD5_NO_ARRAY_BUFFER&&"undefined"!=typeof ArrayBuffer,c="0123456789abcdef".split(""),y=[128,32768,8388608,-2147483648],p=[0,8,16,24],d=["hex","array","digest","buffer","arrayBuffer","base64"],l="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""),b=[];if(u){var v=new ArrayBuffer(68);a=new Uint8Array(v),b=new Uint32Array(v)}var w=Array.isArray;!s.JS_MD5_NO_NODE_JS&&w||(w=function(t){return"[object Array]"===Object.prototype.toString.call(t)});var A=ArrayBuffer.isView;!u||!s.JS_MD5_NO_ARRAY_BUFFER_IS_VIEW&&A||(A=function(t){return"object"==typeof t&&t.buffer&&t.buffer.constructor===ArrayBuffer});var _=function(t){var r=typeof t;if("string"===r)return[t,!0];if("object"!==r||null===t)throw new Error(e);if(u&&t.constructor===ArrayBuffer)return[new Uint8Array(t),!1];if(!w(t)&&!A(t))throw new Error(e);return[t,!1]},B=function(r){return function(e){return new t(!0).update(e)[r]()}},g=function(t){var r,i=require("crypto"),h=require("buffer").Buffer;r=h.from&&!s.JS_MD5_NO_BUFFER_FROM?h.from:function(t){return new h(t)};return function(s){if("string"==typeof s)return i.createHash("md5").update(s,"utf8").digest("hex");if(null===s||void 0===s)throw new Error(e);return s.constructor===ArrayBuffer&&(s=new Uint8Array(s)),w(s)||A(s)||s.constructor===h?i.createHash("md5").update(r(s)).digest("hex"):t(s)}},m=function(t){return function(e,i){return new r(e,!0).update(i)[t]()}};t.prototype.update=function(t){if(this.finalized)throw new Error("finalize already called");var r=_(t);t=r[0];for(var e,i,s=r[1],h=0,n=t.length,a=this.blocks,o=this.buffer8;h<n;){if(this.hashed&&(this.hashed=!1,a[0]=a[16],a[16]=a[1]=a[2]=a[3]=a[4]=a[5]=a[6]=a[7]=a[8]=a[9]=a[10]=a[11]=a[12]=a[13]=a[14]=a[15]=0),s)if(u)for(i=this.start;h<n&&i<64;++h)(e=t.charCodeAt(h))<128?o[i++]=e:e<2048?(o[i++]=192|e>>>6,o[i++]=128|63&e):e<55296||e>=57344?(o[i++]=224|e>>>12,o[i++]=128|e>>>6&63,o[i++]=128|63&e):(e=65536+((1023&e)<<10|1023&t.charCodeAt(++h)),o[i++]=240|e>>>18,o[i++]=128|e>>>12&63,o[i++]=128|e>>>6&63,o[i++]=128|63&e);else for(i=this.start;h<n&&i<64;++h)(e=t.charCodeAt(h))<128?a[i>>>2]|=e<<p[3&i++]:e<2048?(a[i>>>2]|=(192|e>>>6)<<p[3&i++],a[i>>>2]|=(128|63&e)<<p[3&i++]):e<55296||e>=57344?(a[i>>>2]|=(224|e>>>12)<<p[3&i++],a[i>>>2]|=(128|e>>>6&63)<<p[3&i++],a[i>>>2]|=(128|63&e)<<p[3&i++]):(e=65536+((1023&e)<<10|1023&t.charCodeAt(++h)),a[i>>>2]|=(240|e>>>18)<<p[3&i++],a[i>>>2]|=(128|e>>>12&63)<<p[3&i++],a[i>>>2]|=(128|e>>>6&63)<<p[3&i++],a[i>>>2]|=(128|63&e)<<p[3&i++]);else if(u)for(i=this.start;h<n&&i<64;++h)o[i++]=t[h];else for(i=this.start;h<n&&i<64;++h)a[i>>>2]|=t[h]<<p[3&i++];this.lastByteIndex=i,this.bytes+=i-this.start,i>=64?(this.start=i-64,this.hash(),this.hashed=!0):this.start=i}return this.bytes>4294967295&&(this.hBytes+=this.bytes/4294967296<<0,this.bytes=this.bytes%4294967296),this},t.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,r=this.lastByteIndex;t[r>>>2]|=y[3&r],r>=56&&(this.hashed||this.hash(),t[0]=t[16],t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[14]=this.bytes<<3,t[15]=this.hBytes<<3|this.bytes>>>29,this.hash()}},t.prototype.hash=function(){var t,r,e,i,s,h,n=this.blocks;this.first?r=((r=((t=((t=n[0]-680876937)<<7|t>>>25)-271733879<<0)^(e=((e=(-271733879^(i=((i=(-1732584194^2004318071&t)+n[1]-117830708)<<12|i>>>20)+t<<0)&(-271733879^t))+n[2]-1126478375)<<17|e>>>15)+i<<0)&(i^t))+n[3]-1316259209)<<22|r>>>10)+e<<0:(t=this.h0,r=this.h1,e=this.h2,r=((r+=((t=((t+=((i=this.h3)^r&(e^i))+n[0]-680876936)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+n[1]-389564586)<<12|i>>>20)+t<<0)&(t^r))+n[2]+606105819)<<17|e>>>15)+i<<0)&(i^t))+n[3]-1044525330)<<22|r>>>10)+e<<0),r=((r+=((t=((t+=(i^r&(e^i))+n[4]-176418897)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+n[5]+1200080426)<<12|i>>>20)+t<<0)&(t^r))+n[6]-1473231341)<<17|e>>>15)+i<<0)&(i^t))+n[7]-45705983)<<22|r>>>10)+e<<0,r=((r+=((t=((t+=(i^r&(e^i))+n[8]+1770035416)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+n[9]-1958414417)<<12|i>>>20)+t<<0)&(t^r))+n[10]-42063)<<17|e>>>15)+i<<0)&(i^t))+n[11]-1990404162)<<22|r>>>10)+e<<0,r=((r+=((t=((t+=(i^r&(e^i))+n[12]+1804603682)<<7|t>>>25)+r<<0)^(e=((e+=(r^(i=((i+=(e^t&(r^e))+n[13]-40341101)<<12|i>>>20)+t<<0)&(t^r))+n[14]-1502002290)<<17|e>>>15)+i<<0)&(i^t))+n[15]+1236535329)<<22|r>>>10)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+n[1]-165796510)<<5|t>>>27)+r<<0)^r))+n[6]-1069501632)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+n[11]+643717713)<<14|e>>>18)+i<<0)^i))+n[0]-373897302)<<20|r>>>12)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+n[5]-701558691)<<5|t>>>27)+r<<0)^r))+n[10]+38016083)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+n[15]-660478335)<<14|e>>>18)+i<<0)^i))+n[4]-405537848)<<20|r>>>12)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+n[9]+568446438)<<5|t>>>27)+r<<0)^r))+n[14]-1019803690)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+n[3]-187363961)<<14|e>>>18)+i<<0)^i))+n[8]+1163531501)<<20|r>>>12)+e<<0,r=((r+=((i=((i+=(r^e&((t=((t+=(e^i&(r^e))+n[13]-1444681467)<<5|t>>>27)+r<<0)^r))+n[2]-51403784)<<9|i>>>23)+t<<0)^t&((e=((e+=(t^r&(i^t))+n[7]+1735328473)<<14|e>>>18)+i<<0)^i))+n[12]-1926607734)<<20|r>>>12)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+n[5]-378558)<<4|t>>>28)+r<<0))+n[8]-2022574463)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+n[11]+1839030562)<<16|e>>>16)+i<<0))+n[14]-35309556)<<23|r>>>9)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+n[1]-1530992060)<<4|t>>>28)+r<<0))+n[4]+1272893353)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+n[7]-155497632)<<16|e>>>16)+i<<0))+n[10]-1094730640)<<23|r>>>9)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+n[13]+681279174)<<4|t>>>28)+r<<0))+n[0]-358537222)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+n[3]-722521979)<<16|e>>>16)+i<<0))+n[6]+76029189)<<23|r>>>9)+e<<0,r=((r+=((h=(i=((i+=((s=r^e)^(t=((t+=(s^i)+n[9]-640364487)<<4|t>>>28)+r<<0))+n[12]-421815835)<<11|i>>>21)+t<<0)^t)^(e=((e+=(h^r)+n[15]+530742520)<<16|e>>>16)+i<<0))+n[2]-995338651)<<23|r>>>9)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+n[0]-198630844)<<6|t>>>26)+r<<0)|~e))+n[7]+1126891415)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+n[14]-1416354905)<<15|e>>>17)+i<<0)|~t))+n[5]-57434055)<<21|r>>>11)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+n[12]+1700485571)<<6|t>>>26)+r<<0)|~e))+n[3]-1894986606)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+n[10]-1051523)<<15|e>>>17)+i<<0)|~t))+n[1]-2054922799)<<21|r>>>11)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+n[8]+1873313359)<<6|t>>>26)+r<<0)|~e))+n[15]-30611744)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+n[6]-1560198380)<<15|e>>>17)+i<<0)|~t))+n[13]+1309151649)<<21|r>>>11)+e<<0,r=((r+=((i=((i+=(r^((t=((t+=(e^(r|~i))+n[4]-145523070)<<6|t>>>26)+r<<0)|~e))+n[11]-1120210379)<<10|i>>>22)+t<<0)^((e=((e+=(t^(i|~r))+n[2]+718787259)<<15|e>>>17)+i<<0)|~t))+n[9]-343485551)<<21|r>>>11)+e<<0,this.first?(this.h0=t+1732584193<<0,this.h1=r-271733879<<0,this.h2=e-1732584194<<0,this.h3=i+271733878<<0,this.first=!1):(this.h0=this.h0+t<<0,this.h1=this.h1+r<<0,this.h2=this.h2+e<<0,this.h3=this.h3+i<<0)},t.prototype.hex=function(){this.finalize();var t=this.h0,r=this.h1,e=this.h2,i=this.h3;return c[t>>>4&15]+c[15&t]+c[t>>>12&15]+c[t>>>8&15]+c[t>>>20&15]+c[t>>>16&15]+c[t>>>28&15]+c[t>>>24&15]+c[r>>>4&15]+c[15&r]+c[r>>>12&15]+c[r>>>8&15]+c[r>>>20&15]+c[r>>>16&15]+c[r>>>28&15]+c[r>>>24&15]+c[e>>>4&15]+c[15&e]+c[e>>>12&15]+c[e>>>8&15]+c[e>>>20&15]+c[e>>>16&15]+c[e>>>28&15]+c[e>>>24&15]+c[i>>>4&15]+c[15&i]+c[i>>>12&15]+c[i>>>8&15]+c[i>>>20&15]+c[i>>>16&15]+c[i>>>28&15]+c[i>>>24&15]},t.prototype.toString=t.prototype.hex,t.prototype.digest=function(){this.finalize();var t=this.h0,r=this.h1,e=this.h2,i=this.h3;return[255&t,t>>>8&255,t>>>16&255,t>>>24&255,255&r,r>>>8&255,r>>>16&255,r>>>24&255,255&e,e>>>8&255,e>>>16&255,e>>>24&255,255&i,i>>>8&255,i>>>16&255,i>>>24&255]},t.prototype.array=t.prototype.digest,t.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(16),r=new Uint32Array(t);return r[0]=this.h0,r[1]=this.h1,r[2]=this.h2,r[3]=this.h3,t},t.prototype.buffer=t.prototype.arrayBuffer,t.prototype.base64=function(){for(var t,r,e,i="",s=this.array(),h=0;h<15;)t=s[h++],r=s[h++],e=s[h++],i+=l[t>>>2]+l[63&(t<<4|r>>>4)]+l[63&(r<<2|e>>>6)]+l[63&e];return t=s[h],i+=l[t>>>2]+l[t<<4&63]+"=="},(r.prototype=new t).finalize=function(){if(t.prototype.finalize.call(this),this.inner){this.inner=!1;var r=this.array();t.call(this,this.sharedMemory),this.update(this.oKeyPad),this.update(r),t.prototype.finalize.call(this)}};var O=function(){var r=B("hex");n&&(r=g(r)),r.create=function(){return new t},r.update=function(t){return r.create().update(t)};for(var e=0;e<d.length;++e){var i=d[e];r[i]=B(i)}return r}();O.md5=O,O.md5.hmac=function(){var t=m("hex");t.create=function(t){return new r(t)},t.update=function(r,e){return t.create(r).update(e)};for(var e=0;e<d.length;++e){var i=d[e];t[i]=m(i)}return t}(),o?module.exports=O:(s.md5=O,f&&define(function(){return O}))}();
            
            _this.md5 = md5
        }

        calculateMD5Hash(file, chunkSize = 2097152) {
            return new Promise((resolve, reject) => {
                let reader = new FileReader(),
                    position = 0,
                    total_size = file.size,
                    hasher = _this.md5
                ;

                reader.onload = function(e) {
                    try {
                        hasher = hasher.update(e.target.result);
                        next();
                    } catch (e) {
                        reject(e)
                    }
                };

                function next() {
                    if (position < total_size) {
                        var end = Math.min(position + chunkSize, total_size);

                        console.log((position / total_size * 100).toFixed(2) + "%");

                        reader.readAsArrayBuffer(file.slice(position, end));
                        position = end
                    } else {
                        resolve(hasher.hex());
                    }
                }

                next();
            })
        }

        async checkRemoteHash(hash){
            let result = await(await fetch(_this.endpoint + "/file/check/" + hash)).json()

            if(result && !result.error){
                return result
            }

            return false
        }

        async uploadBlob(file){
            let hash = await _this.calculateMD5Hash(file);

            if(!hash){
                // ...
                return false
            }

            let status = await _this.checkRemoteHash(hash);

            if(!status){
                // error
                return false
            }

            let uploadResults;
            
            if(status.exists){

                // ... Already exists on the remote machine!, skip upload
                return [{
                    hash,
                    originalName: file.name,
                    mimeType: file.type,
                    ignored: true,
                    success: true,
                    url: `${endpoint}/file/${hash}.${file.name.split(".").at(-1)}`,
                    name: `${hash}.${file.name.split(".").at(-1)}`
                }]

            } else {

                const form = new FormData();
                form.append('file', file);
        
                uploadResults = await(await fetch(endpoint + "/upload?checkNSFW", {method: "POST", body: form})).json();
        
                if(!uploadResults || uploadResults.error || !Array.isArray(uploadResults)){
                    // todo; handle error
                    return false
                }

                return uploadResults
            }
        }

        async uploadInput(input, clear = true){
            if (!input.files.length) {
                return [];
            }

            const files = Array.from(input.files);

            let results;
    
            let i = -1;
            for(let file of files){
                i++;
                
                let upload = await _this.uploadBlob(file);

                if(!upload || !Array.isArray(upload)) return false;

                results.push(...upload);
            }

            if(clear) input.value = null;
            return results
        }
    })())
}