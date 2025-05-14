
// JavaScript to handle form submissions and button states
document.addEventListener('DOMContentLoaded', function () {
    var emailInput = document.getElementById('email');
    var otpFormEmail = document.querySelector('#request-otp-form input[name="email"]');
    var deleteFormEmail = document.querySelector('#delete-account-form input[name="email"]');
    var requestOtpBtn = document.getElementById('request-otp-btn');
    var deleteAccountBtn = document.getElementById('delete-account-btn');

    function validateEmail(email) {
        var re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(String(email).toLowerCase());
    }

    // Synchronize email input across forms
    function syncEmail() {
        otpFormEmail.value = emailInput.value;
        deleteFormEmail.value = emailInput.value;
    }
    emailInput.addEventListener('input', syncEmail);
    syncEmail(); // Initialize on page load

    // Handle OTP request form submission
    $('#request-otp-form').on('submit', function (event) {
        event.preventDefault();
        if (!validateEmail(emailInput.value)) {
            alert("Please enter a valid email address.");
            return;
        }
        requestOtpBtn.disabled = true;
        $.ajax({
            type: 'GET',
            url: '/api/v1/member/otp',
            data: { email: emailInput.value },
            success: function (response) {
                alert("OTP sent successfully to your email!");
                return;
            },
            error: function (xhr) {
                var errorMessage = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "An unknown error occurred.";
                alert(errorMessage);
                return;
            },
            complete: function () {
                requestOtpBtn.disabled = false;
            }
        });
    });

    // Handle account deletion form submission
    $('#delete-account-form').on('submit', function (event) {
        event.preventDefault();
        if (!validateEmail(emailInput.value)) {
            alert("Please enter a valid email address.");
            return;
        }
        deleteAccountBtn.disabled = true;
        $.ajax({
            type: 'DELETE',
            url: '/api/v1/member',
            data: {
                email: emailInput.value,
                password: $('#password').val(),
                otp: $('#otp').val()
            },
            success: function (response) {
                alert("Account deleted successfully!");
                return;
            },
            error: function (xhr) {
                var errorMessage = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : "An unknown error occurred.";
                alert(errorMessage);
                return;
            },
            complete: function () {
                deleteAccountBtn.disabled = false;
            }
        });
    });
});
