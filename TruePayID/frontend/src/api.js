import axios from "axios";

const API = axios.create({
  baseURL: "https://upi-backend-xbx5.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;


