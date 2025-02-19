import { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import axios from "axios";
import { StatisticsRequest } from "../model/statistics";

dotenv.config();

const url = process.env.INFLUXDB_URL;
const token = process.env.INFLUXDB_ACCESS_TOKEN;

const handler = async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type, data }: StatisticsRequest = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ error: 'Missing required fields: type and data' });
    }

    let endpoint: string;
    switch (type) {
      case 'visit':
        endpoint = '/api/v1/miniapp_stats/visit';
        break;
      case 'view':
        endpoint = '/api/v1/miniapp_stats/view';
        break;
      case 'order':
        endpoint = '/api/v1/miniapp_stats/order';
        break;
      default:
        return res.status(400).json({ error: 'Invalid statistics type' });
    }

    // Validate data structure based on type
    // if (type === 'view' && !Array.isArray(data)) {
    //   return res.status(400).json({ error: 'View statistics data must be an array' });
    // }

    if (type === 'order' && !('order_number' in data)) {
      return res.status(400).json({ error: 'Order statistics must include order_number' });
    }

    console.log("Request URL:", `${url}${endpoint}`);
    console.log("Request Body:", { type, data });

    const response = await axios.post(
      `${url}${endpoint}`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: null
      }
    );

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.data}`);
    }

    console.log(`Successfully recorded ${type} statistics`);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error posting statistics:', error);
    return res.status(500).json({ 
      error: 'Failed to post statistics',
      details: error.message 
    });
  }
};

const allowCors = (fn) => async (req, res) => {
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Access-Control-Allow-Origin", "*");
  
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,OPTIONS,PATCH,DELETE,POST,PUT"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
    );
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }
    return await fn(req, res);
  };

export default allowCors(handler);