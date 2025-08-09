module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#C4564B",
          neutral: "#D8D8D7"
        }
      },
      borderRadius: { '2xl': '1rem' }
    }
  },
  plugins: []
};
