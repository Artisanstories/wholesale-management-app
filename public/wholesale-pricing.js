document.addEventListener("DOMContentLoaded", function () {
  const wholesaleTag = "wholesale";
  const isWholesale = window.Shopify && Shopify.customer && Shopify.customer.tags.includes(wholesaleTag);

  if (isWholesale) {
    document.querySelectorAll(".price").forEach(el => {
      const original = parseFloat(el.textContent.replace(/[^0-9.]/g, ""));
      const discounted = original * 0.4;
      el.textContent = "£" + discounted.toFixed(2);
    });
  }
});