import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load .env from monad-contracts directory
dotenv.config({ path: path.join(process.cwd(), ".env") });

async function main() {
  console.log("🚀 Deploying MockUSDT and updating backend...\n");
  
  const rpcUrl = process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";
  const privateKey = process.env.MONAD_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("❌ MONAD_PRIVATE_KEY not found in monad-contracts/.env");
    console.error("\n📝 Please create monad-contracts/.env with:");
    console.error("MONAD_RPC_URL=https://rpc.monad.xyz");
    console.error("MONAD_PRIVATE_KEY=your_private_key_without_0x");
    process.exit(1);
  }
  
  // Create provider and wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("📍 Deploying with account:", wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MON\n");
  
  if (balance === BigInt(0)) {
    console.error("⚠️  Warning: Account has zero balance. You may need testnet MON tokens.");
  }
  
  // Read contract artifact
  const artifactPath = path.join(process.cwd(), "artifacts", "contracts", "MockUSDT.sol", "MockUSDT.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("❌ Contract artifact not found. Run 'npm run compile' first.");
    process.exit(1);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  // Deploy contract
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("📦 Deploying MockUSDT contract...");
  
  const usdt = await factory.deploy();
  console.log("⏳ Waiting for deployment confirmation...");
  
  await usdt.waitForDeployment();
  const address = await usdt.getAddress();
  
  console.log("\n✅ MockUSDT deployed successfully!");
  console.log("📍 Contract Address:", address);
  console.log("📊 Total Supply: 1,000,000,000 USDT (6 decimals)");
  console.log("👤 Owner/Deployer:", wallet.address);
  
  // Update env.example in root
  const rootEnvPath = path.join(process.cwd(), "..", "env.example");
  if (fs.existsSync(rootEnvPath)) {
    let envContent = fs.readFileSync(rootEnvPath, "utf8");
    
    // Update or add USDT contract address
    if (envContent.includes("NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=")) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=.*/,
        `NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=${address}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_USDT_CONTRACT_ADDRESS=${address}\n`;
    }
    
    fs.writeFileSync(rootEnvPath, envContent);
    console.log("\n✅ Updated ../env.example with USDT contract address");
  }
  
  // Update .env.local if it exists
  const envLocalPath = path.join(process.cwd(), "..", ".env.local");
  if (fs.existsSync(envLocalPath)) {
    let envLocalContent = fs.readFileSync(envLocalPath, "utf8");
    
    if (envLocalContent.includes("NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=")) {
      envLocalContent = envLocalContent.replace(
        /NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=.*/,
        `NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=${address}`
      );
    } else {
      envLocalContent += `\nNEXT_PUBLIC_USDT_CONTRACT_ADDRESS=${address}\n`;
    }
    
    fs.writeFileSync(envLocalPath, envLocalContent);
    console.log("✅ Updated ../.env.local with USDT contract address");
  }
  
  console.log("\n📋 Summary:");
  console.log("📍 TokenEscrow: 0xE3F874e3D0c462351BC525a752Fc7d0e7ad8482B");
  console.log(`📍 MockUSDT: ${address}`);
  console.log("\n💡 Add to your Vercel environment variables:");
  console.log(`NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error.message);
    process.exitCode = 1;
  });
