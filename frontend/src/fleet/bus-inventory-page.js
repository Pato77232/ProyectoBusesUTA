import { createApiClient } from "../api/api-client.js";
import { createBusInventoryController } from "./bus-inventory-controller.js";
import { createBusInventoryView } from "./bus-inventory-view.js";

createBusInventoryController({
  client: createApiClient(),
  view: createBusInventoryView(),
}).start();
