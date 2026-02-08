import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-ethers";

dotenv.config();

const config = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    monad: {
      type: "http",
      url: process.env.MONAD_RPC_URL || "https://rpc.monad.xyz",
      accounts: process.env.MONAD_PRIVATE_KEY
        ? [process.env.MONAD_PRIVATE_KEY]
        : [],
      chainId: 10143,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
