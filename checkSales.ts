import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";

const OPENSEA_SHARED_STOREFRONT_ADDRESS = '0x495f947276749Ce646f68AC8c248420045cb7b5e';

const discordBot = new Discord.Client();
let salesChannel, listingsChannel
const discordSetup = async (): Promise<TextChannel> => {
  return new Promise<TextChannel>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_SALES_CHANNEL_ID', 'DISCORD_LISTINGS_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })

    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      salesChannel = await discordBot.channels.fetch(process.env.DISCORD_SALES_CHANNEL_ID!);
      listingsChannel = await discordBot.channels.fetch(process.env.DISCORD_LISTINGS_CHANNEL_ID!);
      resolve(salesChannel as TextChannel);
    });
  })
}

const buildSaleMessage = (sale: any) => (
  new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(`${sale.asset.name} #${sale.asset.token_id}`)
	.setURL(sale.asset.permalink)
	.setAuthor('OpenSea Sale', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png', 'https://github.com/sbauch/opensea-discord-bot')
	// .setThumbnail(sale.asset.collection.image_url)
	.addFields(
    { name: 'Amount', value: `${ethers.utils.formatEther(sale.total_price || '0')}${ethers.constants.EtherSymbol}`},
    { name: 'Buyer', value: sale?.winner_account?.user?.username || sale?.winner_account?.address, },
		{ name: 'Seller', value: sale?.seller?.user?.username || sale?.seller?.address,  },
	)
  .setImage(sale.asset.image_url)
	.setTimestamp(Date.parse(`${sale?.created_date}Z`))
	// .setFooter(`OpenSea ${capitalizeFirstLetter(type)}`, 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png')
)

const buildListingMessage = (sale: any) => (
  new Discord.MessageEmbed()
	.setColor('#00ff99')
	.setTitle(`${sale.asset.name} #${sale.asset.token_id}`)
	.setURL(sale.asset.permalink)
	.setAuthor('OpenSea Listing', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png', 'https://github.com/sbauch/opensea-discord-bot')
	// .setThumbnail(sale.from_account.profile_img_url)
	.addFields(
		{ name: 'Seller', value: sale?.seller?.user?.username || sale?.seller?.address },
    // { name: 'Auction type', value: sale?.auction_type },
    // { name: 'Starting price', value: `${ethers.utils.formatEther(sale.starting_price || '0')}${ethers.constants.EtherSymbol}` },
    // { name: 'Ending price', value: `${ethers.utils.formatEther(sale.starting_price || '0')}${ethers.constants.EtherSymbol}`},
    { name: 'Price', value: `${ethers.utils.formatEther(sale.starting_price || '0')}${ethers.constants.EtherSymbol}`},
	)
  .setImage(sale.asset.image_url)
	.setTimestamp(Date.parse(`${sale?.created_date}Z`))
	// .setFooter(`OpenSea ${capitalizeFirstLetter(type)}`, 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png')
)

async function main() {
  // const channel = await discordSetup();
  await discordSetup();
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  console.log({ seconds, hoursAgo })

  const params = new URLSearchParams({
    offset: '0',
    // event_type: 'successful',
    // event_type: 'created',
    only_opensea: 'false',
    occurred_after: hoursAgo.toString(),
    collection_slug: process.env.COLLECTION_SLUG!,
    limit: '100'
  })

  if (process.env.CONTRACT_ADDRESS !== OPENSEA_SHARED_STOREFRONT_ADDRESS) {
    params.append('asset_contract_address', process.env.CONTRACT_ADDRESS!)
  }

  const openSeaResponse = await fetch(
    "https://api.opensea.io/api/v1/events?" + params).then((resp) => resp.json());

  return await Promise.all(
    openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
      if (sale.event_type == 'successful') {
        console.debug("posting sale")
        const message = buildSaleMessage(sale);
        return salesChannel.send(message)
      }
      else if (sale.event_type == 'created') {
        console.debug("posting listing")
        const message = buildListingMessage(sale);
        return listingsChannel.send(message)
      }
      else {
        console.error("Don't know how to handle event type =>", sale.event_type)
        return null
      }
    })
  );
}

main()
  .then((res) =>{
    if (!res.length) console.log("No recent sales")
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
