#include <napi.h>
#include <vector>
#include <string>
#include <algorithm>
#include <iostream>
#include <math.h>


// Note: The original JavaScript version is used on the client (/js/client.js)
// Backwards compatibility MUST be kept at all costs

const std::vector<std::string> eventList = {
    "heartbeat",
    "message",
    "subscribe",
    "update",
    "typing",
    "authorize",
    "edit",
    "delete",
    "status",
    "presence",
    "versionCheck",
    "profileChange"
};

std::vector<uint8_t> encodeString(const std::string &str) {
    return std::vector<uint8_t>(str.begin(), str.end());
}

std::string decodeString(const std::vector<uint8_t> &bytes) {
    return std::string(bytes.begin(), bytes.end());
}

Napi::Value A2U8(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::vector<uint8_t> result;
    int i = 0;

    for (uint32_t idx = 0; idx < info.Length(); ++idx) {
        if (!info[idx].IsArray()) continue;

        Napi::Array event = info[idx].As<Napi::Array>();
        bool firstElementProcessed = false;

        for (uint32_t j = 0; j < event.Length(); ++j) {
            Napi::Value value = event[j];
            if (!firstElementProcessed) {
                if (value.IsString()) {
                    std::string str = value.As<Napi::String>();
                    auto it = std::find(eventList.begin(), eventList.end(), str);
                    result.push_back(it != eventList.end() ? std::distance(eventList.begin(), it) : 0);
                } else if (value.IsNumber()) {
                    result.push_back(value.As<Napi::Number>().Uint32Value());
                }
                firstElementProcessed = true;
                continue;
            }

            if (value.IsBoolean()) {
                result.push_back(value.As<Napi::Boolean>().Value() ? 2 : 1);
                continue;
            }

            if (value.IsString()) {
                std::string str = value.As<Napi::String>();
                if (str.empty()) {
                    result.push_back(21);
                    continue;
                }

                std::vector<uint8_t> encoded = encodeString(str);
                uint32_t number = encoded.size();

                // Determine the length prefix byte (11 to 20)
                uint8_t lengthPrefix = 10 + ((number > 0) ? (1 + (int)log2(number) / 8) : 1);
                result.push_back(lengthPrefix);

                // Add the length of the string
                for (int k = 0; k < lengthPrefix - 10; ++k) {
                    result.push_back((number >> (8 * k)) & 0xFF);
                }

                // Add the actual encoded string
                result.insert(result.end(), encoded.begin(), encoded.end());
                continue;
            }

            if (value.IsNumber()) {
                uint32_t number = value.As<Napi::Number>().Uint32Value();
                if (number <= 155) {
                    result.push_back(100 + number);
                    continue;
                }

                std::vector<uint8_t> bytes;
                while (number > 0) {
                    bytes.push_back(number & 0xFF);
                    number >>= 8;
                }

                uint32_t length = bytes.size();
                result.push_back(2 + length);
                result.insert(result.end(), bytes.begin(), bytes.end());
                continue;
            }
        }

        i++;
        if (i != info.Length() && info[i].As<Napi::Array>().Length() > 0) result.push_back(0);
    }

    Napi::ArrayBuffer arrayBuffer = Napi::ArrayBuffer::New(env, result.size());
    uint8_t* data = static_cast<uint8_t*>(arrayBuffer.Data());
    std::copy(result.begin(), result.end(), data);

    // return Napi::Uint8Array::New(env, result.size(), arrayBuffer, 0, napi_uint8_array);
    return arrayBuffer;
}

Napi::Value U82A(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Uint8Array bytes = info[0].As<Napi::Uint8Array>();
    std::vector<Napi::Array> result;
    Napi::Array current = Napi::Array::New(env);
    bool separator = false;
    uint32_t skip = 0;

    auto byteLength = bytes.ByteLength();
    auto data = bytes.Data();

    for (uint32_t i = 0; i < byteLength; ++i) {
        if (skip > 0) {
            skip--;
            continue;
        }

        uint8_t byte = data[i];
        if (separator || i == 0) {
            if (separator) {
                result.push_back(current);
                current = Napi::Array::New(env);
            }
            if (byte < eventList.size()) {
                current.Set(current.Length(), eventList[byte]);
            } else {
                Napi::TypeError::New(env, "Invalid event index").ThrowAsJavaScriptException();
                return env.Undefined();
            }
            separator = false;
            continue;
        }

        if (byte == 0) {
            separator = true;
            continue;
        }

        if (byte == 1 || byte == 2) {
            current.Set(current.Length(), byte == 2);
            continue;
        }

        if (byte == 21) {
            current.Set(current.Length(), "");
            continue;
        }

        bool isString = byte >= 11 && byte <= 20;
        if ((byte >= 3 && byte <= 10) || isString) {
            uint32_t size = byte - (isString ? 10 : 2);
            if (i + size >= byteLength) {
                Napi::TypeError::New(env, "Invalid size").ThrowAsJavaScriptException();
                return env.Undefined();
            }

            uint32_t num = 0;
            for (uint32_t j = 0; j < size; ++j) {
                num += (data[i + (j + 1)] << (j * 8));
            }
            i += size;

            if (isString) {
                if (i + num >= byteLength) {
                    Napi::TypeError::New(env, "Invalid string size").ThrowAsJavaScriptException();
                    return env.Undefined();
                }

                current.Set(current.Length(), decodeString(std::vector<uint8_t>(data + i + 1, data + i + 1 + num)));
                i += num;
            } else {
                current.Set(current.Length(), num);
            }
            continue;
        }

        if (byte >= 100 && byte <= 255) {
            current.Set(current.Length(), byte - 100);
            continue;
        }
    }
    result.push_back(current);

    Napi::Array resultArray = Napi::Array::New(env, result.size());
    for (size_t k = 0; k < result.size(); ++k) {
        resultArray[k] = result[k];
    }

    return resultArray;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "A2U8"), Napi::Function::New(env, A2U8));
    exports.Set(Napi::String::New(env, "U82A"), Napi::Function::New(env, U82A));
    return exports;
}

NODE_API_MODULE(addon, Init)
