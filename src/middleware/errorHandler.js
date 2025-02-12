const errorHandler = (err, req, res, next) => {
    // Log the error for debugging purposes
    console.error(err);

    // Define a general error response structure
    const response = {
        message: err.message || 'Internal Server Error',
        status: err.status || 500,
    };

    // If the error is a validation error or has a status code, use that
    if (err.name === 'ValidationError') {
        response.status = 400;
        response.message = 'Validation error occurred';
    }

    // Send the error response
    res.status(response.status).json({ message: response.message });
};

module.exports = errorHandler;
