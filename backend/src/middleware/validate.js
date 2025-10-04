"use strict";
// backend/src/middleware/validate.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParams = exports.validateQuery = exports.validateBody = exports.validate = void 0;
var zod_1 = require("zod");
var errors_1 = require("../utils/errors");
/**
 * @description Express middleware factory that validates request body, query, or params against a Zod schema.
 */
var validate = function (schema, source) {
    if (source === void 0) { source = 'body'; }
    return function (req, res, next) {
        try {
            var dataToValidate = req[source];
            var parsedData = schema.parse(dataToValidate);
            // Augment the request with a typed property
            req.validatedBody = parsedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                // Map Zod errors to rich details object for client consumption
                var details = error.errors.map(function (err) { return ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }); });
                throw new errors_1.ValidationError('Validation failed for request data.', 'INVALID_INPUT', details);
            }
            next(error);
        }
    };
};
exports.validate = validate;
var validateBody = function (schema) { return (0, exports.validate)(schema, 'body'); };
exports.validateBody = validateBody;
var validateQuery = function (schema) { return (0, exports.validate)(schema, 'query'); };
exports.validateQuery = validateQuery;
var validateParams = function (schema) { return (0, exports.validate)(schema, 'params'); };
exports.validateParams = validateParams;
