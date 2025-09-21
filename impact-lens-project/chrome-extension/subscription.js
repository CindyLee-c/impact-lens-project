document.addEventListener('DOMContentLoaded', () => {
  // Initialize ExtensionPay
  const extpay = ExtPay('impact-lens-news');

  const unlimitedButton = document.getElementById('unlimited-button');
  if (unlimitedButton) {
    unlimitedButton.addEventListener('click', (event) => {
      event.preventDefault(); // Prevent default link behavior
      extpay.openPaymentPage('unlimited'); // Assumes 'unlimited' is the plan nickname in ExtPay
    });
  }
});
