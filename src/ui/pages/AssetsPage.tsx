import { useState } from "react";
import { VehiclesPage } from "./VehiclesPage";
import { PropertiesPage } from "./PropertiesPage";

export function AssetsPage() {
  const [activeTab, setActiveTab] = useState<"vehicles" | "properties">("vehicles");

  return (
    <div className="page-container fade-in">
      <div className="tabs">
        <button
          className={`tab ${activeTab === "vehicles" ? "active" : ""}`}
          onClick={() => setActiveTab("vehicles")}
        >
          Vehicles
        </button>
        <button
          className={`tab ${activeTab === "properties" ? "active" : ""}`}
          onClick={() => setActiveTab("properties")}
        >
          Properties
        </button>
      </div>
      
      <div style={{ marginTop: "16px" }}>
        {activeTab === "vehicles" ? <VehiclesPage /> : <PropertiesPage />}
      </div>
    </div>
  );
}

export default AssetsPage;
