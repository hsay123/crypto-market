import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function main() {
  console.log("Deploying MockUSDT to Monad testnet...");
  
  try {
    const rpcUrl = process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";
    const privateKey = process.env.MONAD_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error("MONAD_PRIVATE_KEY not found in .env file");
    }
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log("Deploying with account:", wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "MON");
    
    // Read contract artifact
    const artifactPath = path.join(process.cwd(), "artifacts", "contracts", "MockUSDT.sol", "MockUSDT.json");
    if (!fs.existsSync(artifactPath)) {
      throw new Error("Contract artifact not found. Run 'npm run compile' first.");
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    
    // Deploy contract
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    console.log("Deploying contract...");
    
    const usdt = await factory.deploy();
    console.log("Waiting for deployment confirmation...");
    
    await usdt.waitForDeployment();
    const address = await usdt.getAddress();

    console.log("\n✅ MockUSDT deployed successfully!");
    console.log("📍 Contract address:", address);
    console.log("📊 Total Supply: 1,000,000,000 USDT (6 decimals)");
    console.log("👤 Owner/Deployer:", wallet.address);
    console.log("\n📋 Add this to your Next.js .env.local file:");
    console.log(`NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=${address}`);
    console.log("\n💡 Note: This is a mock USDT contract for testing.");
    console.log("   The deployer address has the entire supply.");
  } catch (error: any) {
    if (error.message?.includes("MONAD_PRIVATE_KEY")) {
      console.error("\n❌ Error: No private key configured.");
      console.error("Please create monad-contracts/.env with:");
      console.error("MONAD_RPC_URL=https://rpc.monad.xyz");
      console.error("MONAD_PRIVATE_KEY=your_private_key_without_0x");
    } else {
      console.error("\n❌ Deployment failed:", error.message);
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
