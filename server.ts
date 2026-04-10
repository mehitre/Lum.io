import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  app.use(express.json());

  // In-memory store for simulation
  const activeOrders = new Map<string, NodeJS.Timeout[]>();

  app.post("/api/orders", (req, res) => {
    const { orderId, scheduledAt } = req.body;
    if (!orderId) return res.status(400).json({ error: "Order ID required" });

    activeOrders.set(orderId, []);
    
    // Calculate initial delay for scheduled orders
    let initialDelay = 0;
    if (scheduledAt) {
      const now = Date.now();
      initialDelay = Math.max(0, scheduledAt - now);
    }

    // Simulate order lifecycle
    const initialTimeout = setTimeout(() => {
      simulateOrderLifecycle(orderId, io, activeOrders);
    }, initialDelay);

    activeOrders.get(orderId)?.push(initialTimeout);

    res.json({ status: "Order received and processing scheduled" });
  });

  app.post("/api/orders/:orderId/cancel", (req, res) => {
    const { orderId } = req.params;
    const timeouts = activeOrders.get(orderId);
    
    if (timeouts) {
      timeouts.forEach(t => clearTimeout(t));
      activeOrders.delete(orderId);
      console.log(`Order ${orderId} cancelled, simulation stopped.`);
      
      // Notify client about cancellation via socket
      io.to(orderId).emit("status_update", {
        orderId,
        status: "cancelled",
        message: "Your errand has been cancelled.",
      });
    }

    res.json({ status: "Order cancelled" });
  });

  io.on("connection", (socket) => {
    socket.on("join_order", (orderId) => {
      socket.join(orderId);
      console.log(`Socket joined order room: ${orderId}`);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function simulateOrderLifecycle(orderId: string, io: Server, activeOrders: Map<string, NodeJS.Timeout[]>) {
  const updates = [
    { status: "assigned", message: "A runner has been assigned to your errand!", delay: 5000 },
    { status: "in-progress", message: "Your runner has picked up the items!", delay: 15000 },
    { status: "completed", message: "Errand completed! Your items have been delivered.", delay: 25000 },
  ];

  updates.forEach((update) => {
    const timeout = setTimeout(() => {
      io.to(orderId).emit("status_update", {
        orderId,
        status: update.status,
        message: update.message,
      });
      
      // If completed, clean up
      if (update.status === 'completed') {
        activeOrders.delete(orderId);
      }
    }, update.delay);
    
    activeOrders.get(orderId)?.push(timeout);
  });
}

startServer();
