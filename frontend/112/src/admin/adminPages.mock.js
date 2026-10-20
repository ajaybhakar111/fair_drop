export const FAIRNESS_DROPS = [
  { id: "drop_001", name: "Mumbai Music Festival Ticket Drop" },
  { id: "drop_002", name: "Sunset Cinema Early Access" },
];

const makeSimulation = (status = "STARTING", progress = 0) => ({
  status,
  progress,
  traffic: {
    requests: 0,
    requestsPerSecond: 0,
  },
  abuse: {
    detected: 0,
    throttled: 0,
    blocked: 0,
  },
});

export async function startSimulation(payload) {
  return {
    data: {
      simulationId: `sim_${Date.now()}`,
      config: payload,
    },
  };
}

export async function fetchSimulation(simulationId) {
  return {
    data: {
      simulationId,
      simulation: makeSimulation("RUNNING", 48),
    },
  };
}

export async function stopSimulation(simulationId) {
  return {
    data: {
      simulationId,
      simulation: makeSimulation("STOPPED", 100),
    },
  };
}

export async function fetchFairness(dropId) {
  const fairness = {
    dropId,
    integrity: {
      oversold: 0,
      duplicateAllocations: 0,
    },
    tickets: {
      allocated: 500,
      total: 500,
    },
    participants: {
      total: 2800,
      normal: 2600,
      suspicious: 200,
    },
    allocationGroups: {
      lowRequestUsers: {
        participants: 2000,
        allocations: 240,
        allocationRate: 0.12,
      },
      highRequestUsers: {
        participants: 800,
        allocations: 90,
        allocationRate: 0.1125,
      },
    },
  };

  return { data: fairness };
}
