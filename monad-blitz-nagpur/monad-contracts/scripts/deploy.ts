import hre from "hardhat";

async function main() {
  console.log("Deploying TokenEscrow to Monad testnet...");
  
  const TokenEscrow = await hre.ethers.getContractFactory("TokenEscrow");
  const escrow = await TokenEscrow.deploy();

  await escrow.waitForDeployment();
  const address = await escrow.getAddress();

  console.log("\n✅ TokenEscrow deployed successfully!");
  console.log("📍 Contract address:", address);
  console.log("\n📋 Add this to your Next.js .env.local file:");
  console.log(`NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=${address}`);
  console.log(`PRIVATE_KEY=<your_deployer_private_key>`);
  console.log("\n⚠️  IMPORTANT: The PRIVATE_KEY must be the same as MONAD_PRIVATE_KEY used for deployment.");
  console.log("   This account becomes the contract owner and can release tokens from escrow.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
