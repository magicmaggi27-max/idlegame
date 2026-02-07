const gameData = {
  resources: {
    stone: { name: "Stone", baseRate: 1, sellPrice: 1 },
    iron: { name: "Iron", baseRate: 0.6, sellPrice: 3 },
    gems: { name: "Gems", baseRate: 0.2, sellPrice: 12 },
    grassFiber: { name: "Grass Fiber", baseRate: 1.4, sellPrice: 2 },
    sunstone: { name: "Sunstone", baseRate: 0.45, sellPrice: 6 },
    dunePearl: { name: "Dune Pearl", baseRate: 0.22, sellPrice: 14 },
    coral: { name: "Coral", baseRate: 1.1, sellPrice: 4 },
    seaGlass: { name: "Sea Glass", baseRate: 0.5, sellPrice: 8 },
    jungleWood: { name: "Jungle Wood", baseRate: 1.3, sellPrice: 4 },
    amber: { name: "Amber", baseRate: 0.35, sellPrice: 10 },
    obsidian: { name: "Obsidian", baseRate: 0.3, sellPrice: 18 },
    magmaCore: { name: "Magma Core", baseRate: 0.12, sellPrice: 30 },
  },
  mines: [
    {
      id: "main",
      name: "Main Mine",
      theme: "The beating heart of the dwarven realm.",
      unlockCost: 0,
      leftResource: "stone",
      rightResource: "iron",
      baseMultiplier: 1,
      building: {
        id: "tradeHub",
        name: "Trade Hub",
        description: "Boosts gold earned and automatically sells a portion of your stock.",
        baseCost: 200,
        costGrowth: 1.35,
      },
    },
    {
      id: "grass",
      name: "Grasslands Mine",
      theme: "Rolling fields with wind-tuned machinery.",
      unlockCost: 450,
      leftResource: "grassFiber",
      rightResource: "sunstone",
      baseMultiplier: 1.1,
      building: {
        id: "windmill",
        name: "Windmill",
        description: "Amplifies Grasslands production with every level.",
        baseCost: 350,
        costGrowth: 1.32,
      },
    },
    {
      id: "desert",
      name: "Desert Mine",
      theme: "Sands hide ancient gears that bend time.",
      unlockCost: 1400,
      leftResource: "sunstone",
      rightResource: "dunePearl",
      baseMultiplier: 1.15,
      building: {
        id: "hourglass",
        name: "Hourglass Temple",
        description: "Improves idle efficiency and global output.",
        baseCost: 900,
        costGrowth: 1.38,
      },
    },
    {
      id: "ocean",
      name: "Ocean Mine",
      theme: "Tide-forged caverns echo with shimmering waves.",
      unlockCost: 3200,
      leftResource: "coral",
      rightResource: "seaGlass",
      baseMultiplier: 1.2,
      building: {
        id: "tideShrine",
        name: "Tide Shrine",
        description: "Enhances Ocean output and rewards patience.",
        baseCost: 1800,
        costGrowth: 1.4,
      },
    },
    {
      id: "jungle",
      name: "Jungle Mine",
      theme: "Ancient roots infuse the tunnels with alchemy.",
      unlockCost: 7200,
      leftResource: "jungleWood",
      rightResource: "amber",
      baseMultiplier: 1.25,
      building: {
        id: "alchemist",
        name: "Alchemist Hut",
        description: "Brew potions to spike production for a short time.",
        baseCost: 3500,
        costGrowth: 1.45,
      },
    },
    {
      id: "volcano",
      name: "Volcano Mine",
      theme: "Molten halls guarded by the Volcano Goddess.",
      unlockCost: 15000,
      leftResource: "obsidian",
      rightResource: "magmaCore",
      baseMultiplier: 1.35,
      building: {
        id: "goddess",
        name: "Volcano Goddess",
        description: "Blesses your empire with powerful production and gold bonuses.",
        baseCost: 8000,
        costGrowth: 1.5,
      },
    },
  ],
};

const STORAGE_KEY = "idle-dwarfs-save";
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

const defaultState = () => ({
  gold: 0,
  resources: Object.keys(gameData.resources).reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {}),
  layerLevels: gameData.mines.reduce((acc, mine) => {
    acc[mine.id] = { left: 0, right: 0 };
    return acc;
  }, {}),
  unlockedMines: { main: true },
  buildingLevels: gameData.mines.reduce((acc, mine) => {
    acc[mine.id] = 0;
    return acc;
  }, {}),
  potionBuff: { activeUntil: 0 },
  lastUpdate: Date.now(),
});

let state = loadState();
let currentMineId = null;

const ui = {
  goldAmount: document.getElementById("gold-amount"),
  resourceList: document.getElementById("resource-list"),
  globalBonusList: document.getElementById("global-bonus-list"),
  worldView: document.getElementById("world-view"),
  mineView: document.getElementById("mine-view"),
  mineCardTemplate: document.getElementById("mine-card-template"),
  layerTemplate: document.getElementById("layer-template"),
  buildingTemplate: document.getElementById("building-template"),
};

function formatNumber(value) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

function getMineById(id) {
  return gameData.mines.find((mine) => mine.id === id);
}

function getLayerProduction(mineId, side) {
  const mine = getMineById(mineId);
  const resourceKey = side === "left" ? mine.leftResource : mine.rightResource;
  const level = state.layerLevels[mineId][side];
  if (level === 0) return 0;
  const resource = gameData.resources[resourceKey];
  const baseProduction = resource.baseRate * level;
  const mineMultiplier = mine.baseMultiplier;
  const buildingMultiplier = getBuildingProductionMultiplier(mineId);
  const globalMultiplier = getGlobalProductionMultiplier();
  return baseProduction * mineMultiplier * buildingMultiplier * globalMultiplier;
}

function getGlobalProductionMultiplier() {
  const hourglassLevel = state.buildingLevels.desert || 0;
  const alchemistLevel = state.buildingLevels.jungle || 0;
  const goddessLevel = state.buildingLevels.volcano || 0;
  const potionBuffActive = state.potionBuff.activeUntil > Date.now();
  const potionMultiplier = potionBuffActive ? 2 : 1;
  return (
    (1 + hourglassLevel * 0.02) *
    (1 + alchemistLevel * 0.02) *
    (1 + goddessLevel * 0.03) *
    potionMultiplier
  );
}

function getBuildingProductionMultiplier(mineId) {
  const level = state.buildingLevels[mineId] || 0;
  switch (mineId) {
    case "grass":
      return 1 + level * 0.05;
    case "ocean":
      return 1 + level * 0.04;
    case "volcano":
      return 1 + level * 0.06;
    default:
      return 1;
  }
}

function getSellBonusMultiplier() {
  const tradeHubLevel = state.buildingLevels.main || 0;
  const goddessLevel = state.buildingLevels.volcano || 0;
  return 1 + tradeHubLevel * 0.05 + goddessLevel * 0.04;
}

function getAutoSellRate() {
  const tradeHubLevel = state.buildingLevels.main || 0;
  return tradeHubLevel * 0.01;
}

function layerBaseCost(mineId, side) {
  const mineIndex = gameData.mines.findIndex((mine) => mine.id === mineId);
  const sideMultiplier = side === "left" ? 1 : 1.2;
  return 35 * (mineIndex + 1) * sideMultiplier;
}

function getLayerUpgradeCost(mineId, side, amount) {
  const startLevel = state.layerLevels[mineId][side];
  const growth = 1.15;
  let total = 0;
  for (let i = 0; i < amount; i += 1) {
    total += layerBaseCost(mineId, side) * growth ** (startLevel + i);
  }
  return total;
}

function getBuildingUpgradeCost(mineId) {
  const mine = getMineById(mineId);
  const level = state.buildingLevels[mineId];
  return mine.building.baseCost * mine.building.costGrowth ** level;
}

function updateGold(amount) {
  state.gold = Math.max(0, state.gold + amount);
}

function addResource(resourceKey, amount) {
  state.resources[resourceKey] += amount;
}

function produceResources(deltaSeconds) {
  gameData.mines.forEach((mine) => {
    if (!state.unlockedMines[mine.id]) return;
    const leftAmount = getLayerProduction(mine.id, "left") * deltaSeconds;
    const rightAmount = getLayerProduction(mine.id, "right") * deltaSeconds;
    if (leftAmount > 0) addResource(mine.leftResource, leftAmount);
    if (rightAmount > 0) addResource(mine.rightResource, rightAmount);
  });

  const autoSellRate = getAutoSellRate();
  if (autoSellRate > 0) {
    Object.keys(state.resources).forEach((key) => {
      const amountToSell = state.resources[key] * autoSellRate * deltaSeconds;
      if (amountToSell <= 0) return;
      state.resources[key] -= amountToSell;
      updateGold(amountToSell * gameData.resources[key].sellPrice * getSellBonusMultiplier());
    });
  }
}

function sellResource(resourceKey) {
  const amount = state.resources[resourceKey];
  if (amount <= 0) return;
  state.resources[resourceKey] = 0;
  const goldEarned = amount * gameData.resources[resourceKey].sellPrice * getSellBonusMultiplier();
  updateGold(goldEarned);
  render();
}

function unlockMine(mineId) {
  const mine = getMineById(mineId);
  if (state.unlockedMines[mineId]) return;
  if (state.gold < mine.unlockCost) return;
  updateGold(-mine.unlockCost);
  state.unlockedMines[mineId] = true;
  render();
}

function upgradeLayer(mineId, side, amount) {
  const cost = getLayerUpgradeCost(mineId, side, amount);
  if (state.gold < cost) return;
  updateGold(-cost);
  state.layerLevels[mineId][side] += amount;
  render();
}

function upgradeBuilding(mineId) {
  const cost = getBuildingUpgradeCost(mineId);
  if (state.gold < cost) return;
  updateGold(-cost);
  state.buildingLevels[mineId] += 1;
  render();
}

function activatePotion() {
  const cost = 2200 + state.buildingLevels.jungle * 400;
  if (state.gold < cost) return;
  updateGold(-cost);
  state.potionBuff.activeUntil = Date.now() + 60 * 1000;
  render();
}

function navigateToWorld() {
  currentMineId = null;
  ui.worldView.classList.remove("hidden");
  ui.mineView.classList.add("hidden");
  renderWorld();
}

function navigateToMine(mineId) {
  currentMineId = mineId;
  ui.worldView.classList.add("hidden");
  ui.mineView.classList.remove("hidden");
  renderMine(mineId);
}

function render() {
  ui.goldAmount.textContent = formatNumber(state.gold);
  renderResources();
  renderGlobalBonuses();
  if (currentMineId) {
    renderMine(currentMineId);
  } else {
    renderWorld();
  }
}

function renderResources() {
  ui.resourceList.innerHTML = "";
  Object.entries(gameData.resources).forEach(([key, resource]) => {
    const amount = state.resources[key];
    const perSecond = calculateResourcePerSecond(key);
    const row = document.createElement("div");
    row.className = "resource-row";
    row.innerHTML = `
      <div>
        <strong>${resource.name}</strong>
        <div>${formatNumber(amount)} stored</div>
        <div>${formatNumber(perSecond)}/s</div>
      </div>
    `;
    const button = document.createElement("button");
    button.textContent = `Sell all (${resource.sellPrice}g)`;
    button.disabled = amount <= 0;
    button.addEventListener("click", () => sellResource(key));
    row.appendChild(button);
    ui.resourceList.appendChild(row);
  });
}

function calculateResourcePerSecond(resourceKey) {
  let total = 0;
  gameData.mines.forEach((mine) => {
    if (!state.unlockedMines[mine.id]) return;
    if (mine.leftResource === resourceKey) {
      total += getLayerProduction(mine.id, "left");
    }
    if (mine.rightResource === resourceKey) {
      total += getLayerProduction(mine.id, "right");
    }
  });
  const autoSellRate = getAutoSellRate();
  if (autoSellRate > 0) {
    total -= state.resources[resourceKey] * autoSellRate;
  }
  return Math.max(0, total);
}

function renderWorld() {
  ui.worldView.innerHTML = "<h2>World Map</h2>";
  gameData.mines.forEach((mine) => {
    const card = ui.mineCardTemplate.content.cloneNode(true);
    const title = card.querySelector(".mine-title");
    const description = card.querySelector(".mine-description");
    const resources = card.querySelector(".mine-resources");
    const actions = card.querySelector(".mine-actions");

    title.textContent = mine.name;
    description.textContent = mine.theme;
    resources.innerHTML = `
      <li>Left: ${gameData.resources[mine.leftResource].name}</li>
      <li>Right: ${gameData.resources[mine.rightResource].name}</li>
    `;

    if (state.unlockedMines[mine.id]) {
      const button = document.createElement("button");
      button.textContent = "Enter Mine";
      button.addEventListener("click", () => navigateToMine(mine.id));
      actions.appendChild(button);
    } else {
      const unlockButton = document.createElement("button");
      unlockButton.textContent = `Unlock (${formatNumber(mine.unlockCost)}g)`;
      unlockButton.disabled = state.gold < mine.unlockCost;
      unlockButton.addEventListener("click", () => unlockMine(mine.id));
      actions.appendChild(unlockButton);
    }

    ui.worldView.appendChild(card);
  });
}

function renderMine(mineId) {
  const mine = getMineById(mineId);
  ui.mineView.innerHTML = "";

  const backButton = document.createElement("button");
  backButton.textContent = "← Back to World Map";
  backButton.className = "back-button";
  backButton.addEventListener("click", navigateToWorld);
  ui.mineView.appendChild(backButton);

  const header = document.createElement("div");
  header.className = "panel";
  header.innerHTML = `
    <h2>${mine.name}</h2>
    <p>${mine.theme}</p>
  `;
  ui.mineView.appendChild(header);

  const layerGrid = document.createElement("div");
  layerGrid.className = "layer-grid";
  ["left", "right"].forEach((side) => {
    const card = ui.layerTemplate.content.cloneNode(true);
    const title = card.querySelector(".layer-title");
    const resourceText = card.querySelector(".layer-resource");
    const stats = card.querySelector(".layer-stats");
    const actions = card.querySelector(".layer-actions");
    const resourceKey = side === "left" ? mine.leftResource : mine.rightResource;
    const resource = gameData.resources[resourceKey];
    const level = state.layerLevels[mineId][side];
    const production = getLayerProduction(mineId, side);

    title.textContent = `${side === "left" ? "Left" : "Right"} Layer`;
    resourceText.textContent = `Produces ${resource.name}`;
    stats.innerHTML = `Level ${level} • ${formatNumber(production)}/s`;

    [1, 10, 100].forEach((amount) => {
      const cost = getLayerUpgradeCost(mineId, side, amount);
      const button = document.createElement("button");
      button.textContent = `Upgrade +${amount} (${formatNumber(cost)}g)`;
      button.disabled = state.gold < cost;
      button.addEventListener("click", () => upgradeLayer(mineId, side, amount));
      actions.appendChild(button);
    });

    layerGrid.appendChild(card);
  });
  ui.mineView.appendChild(layerGrid);

  const buildingCard = ui.buildingTemplate.content.cloneNode(true);
  const buildingTitle = buildingCard.querySelector(".building-title");
  const buildingDesc = buildingCard.querySelector(".building-description");
  const buildingEffect = buildingCard.querySelector(".building-effect");
  const buildingActions = buildingCard.querySelector(".building-actions");

  const buildingLevel = state.buildingLevels[mineId];
  buildingTitle.textContent = mine.building.name;
  buildingDesc.textContent = mine.building.description;
  buildingEffect.textContent = getBuildingEffectText(mineId, buildingLevel);

  const upgradeButton = document.createElement("button");
  const upgradeCost = getBuildingUpgradeCost(mineId);
  upgradeButton.textContent = `Upgrade (${formatNumber(upgradeCost)}g)`;
  upgradeButton.disabled = state.gold < upgradeCost;
  upgradeButton.addEventListener("click", () => upgradeBuilding(mineId));
  buildingActions.appendChild(upgradeButton);

  if (mineId === "jungle") {
    const potionButton = document.createElement("button");
    const potionCost = 2200 + buildingLevel * 400;
    potionButton.textContent = `Brew Potion (${formatNumber(potionCost)}g)`;
    potionButton.disabled = state.gold < potionCost;
    potionButton.addEventListener("click", activatePotion);
    buildingActions.appendChild(potionButton);
  }

  ui.mineView.appendChild(buildingCard);
}

function getBuildingEffectText(mineId, level) {
  switch (mineId) {
    case "main":
      return `Level ${level} • +${(level * 5).toFixed(0)}% gold bonus, ${(
        level * 1
      ).toFixed(0)}% auto-sell per second.`;
    case "grass":
      return `Level ${level} • +${(level * 5).toFixed(0)}% Grasslands production.`;
    case "desert":
      return `Level ${level} • +${(level * 2).toFixed(0)}% global production.`;
    case "ocean":
      return `Level ${level} • +${(level * 4).toFixed(0)}% Ocean production.`;
    case "jungle":
      return `Level ${level} • Unlocks stronger potions and +${(level * 2).toFixed(
        0,
      )}% global production.`;
    case "volcano":
      return `Level ${level} • +${(level * 6).toFixed(0)}% Volcano production and +${(
        level * 4
      ).toFixed(0)}% gold bonus.`;
    default:
      return `Level ${level}`;
  }
}

function renderGlobalBonuses() {
  ui.globalBonusList.innerHTML = "";
  const bonuses = [
    `Global production: x${getGlobalProductionMultiplier().toFixed(2)}`,
    `Gold bonus: x${getSellBonusMultiplier().toFixed(2)}`,
    `Auto-sell: ${(getAutoSellRate() * 100).toFixed(1)}%/s`,
  ];
  bonuses.forEach((bonus) => {
    const item = document.createElement("li");
    item.textContent = bonus;
    ui.globalBonusList.appendChild(item);
  });
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    const fallback = defaultState();
    return {
      ...fallback,
      ...parsed,
      resources: { ...fallback.resources, ...parsed.resources },
      layerLevels: { ...fallback.layerLevels, ...parsed.layerLevels },
      unlockedMines: { ...fallback.unlockedMines, ...parsed.unlockedMines },
      buildingLevels: { ...fallback.buildingLevels, ...parsed.buildingLevels },
      potionBuff: { ...fallback.potionBuff, ...parsed.potionBuff },
    };
  } catch (error) {
    console.warn("Failed to load save, resetting.", error);
    return defaultState();
  }
}

function saveState() {
  state.lastUpdate = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyOfflineProgress() {
  const now = Date.now();
  const deltaSeconds = Math.min(
    MAX_OFFLINE_SECONDS,
    Math.max(0, (now - state.lastUpdate) / 1000),
  );
  if (deltaSeconds > 1) {
    produceResources(deltaSeconds);
  }
  state.lastUpdate = now;
}

function startGameLoop() {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const deltaSeconds = (now - lastTick) / 1000;
    lastTick = now;
    produceResources(deltaSeconds);
    render();
  }, 1000);
}

applyOfflineProgress();
render();
startGameLoop();
setInterval(saveState, 5000);
window.addEventListener("beforeunload", saveState);
