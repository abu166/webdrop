export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: { ink: "#09090b", neon: "#6ee7b7" },
      keyframes: {
        "pulse-subtle": { "50%": { opacity: ".5" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: { "50%": { transform: "translateY(-8px)" } },
      },
      animation: {
        "pulse-subtle": "pulse-subtle 3s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
