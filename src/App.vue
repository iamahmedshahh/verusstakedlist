<template>
  <div>
    <h2> Loading last {{ processBlocks}} Staked Blocks</h2>
    <v-table>
      <thead>
        <tr>
          <th>Block Height</th>
          <th>Block Hash</th>
          <th>Validation Type</th>
          <th>Coinbase Reward Address</th>
          <th>Staking Amount</th>
          <th>Staking Address</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(block, index) in blocks" :key="index">
          <td>
            <a :href="getExplorerLink(block.blockHash)" target="_blank">
            {{ block.blockHeight }}
            </a>
          </td>
          <td>{{ block.blockHash }}</td>
          <td>{{ block.validationType }}</td>
          <td>{{ block.coinbaseRewardAddress }}</td>
          <td>{{ block.stakingAmount }}</td>
          <td>{{ block.stakingAddress }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script>
import axios from 'axios';
import { ref } from 'vue';
export default {
  data() {
    return {
      processBlocks: import.meta.env.VITE_APP_BLOCKS,
      blocks: ref([]),
    };
  },

  methods: {
    sendRequest() {
      const requestConfigGetInfo = {
        method: 'post',
        url: 'https://rpc.vrsc.komodefi.com',
        headers: { 'Content-Type': 'application/json' },
        data: { method: 'getinfo', params: [], id: 1 }
      };
      this.sendAxiosRequest(
        requestConfigGetInfo.method,
        requestConfigGetInfo.url,
        requestConfigGetInfo.headers,
        requestConfigGetInfo.data
      )
        .then((response) => {
          const longestChain = response.data.result.longestchain;
          this.fetchBlockHash(longestChain);
        })
        .catch((error) => {
          console.error(error);
        });
    },
    getExplorerLink(blockHeight) {
      // Replace this URL with the actual explorer URL pattern
      const explorerBaseUrl = 'https://first.sink.cakeshop.dev/api/block/';
      return `${explorerBaseUrl}${blockHeight}`;
    },
    fetchBlockHash(longestChain) {
      const blockHeight = longestChain;
      const requestConfigGetBlockhash = {
        method: 'post',
        url: 'https://rpc.vrsc.komodefi.com',
        headers: { 'Content-Type': 'application/json' },
        data: { method: 'getblockhash', params: [blockHeight], id: 1 }
      };
      this.sendAxiosRequest(
        requestConfigGetBlockhash.method,
        requestConfigGetBlockhash.url,
        requestConfigGetBlockhash.headers,
        requestConfigGetBlockhash.data
      )
        .then((response) => {
          const blockHash = response.data.result;
          this.fetchBlocksAndProcess(this.processBlocks, blockHash);
        })
        .catch((error) => {
          console.error('Error fetching block hash:', error);
        });
    },
    fetchBlocksAndProcess(numBlocks, blockhash) {
      let currentBlockHash = blockhash;
      let blocksProcessed = 0;
      const requestConfigGetBlock = {
        method: 'post',
        url: 'https://rpc.vrsc.komodefi.com',
        headers: { 'Content-Type': 'application/json' },
        data: { method: 'getblock', params: [], id: 1 }
      };

      function processNextBlock() {
        if (blocksProcessed >= numBlocks) {
          return;
        }
        requestConfigGetBlock.data.params = [currentBlockHash, true];
        this.sendAxiosRequest(
          requestConfigGetBlock.method,
          requestConfigGetBlock.url,
          requestConfigGetBlock.headers,
          requestConfigGetBlock.data
        )
          .then((response) => {
            const block = response.data.result;
            const validationType = block.validationtype;

            if (validationType === 'stake') {
              this.processStakeBlock(block);
              blocksProcessed++;
            }

            currentBlockHash = block.previousblockhash;
            processNextBlock.call(this); // Call it with the correct this context
          })
          .catch((error) => {
            console.error('Error fetching block data:', error);
          });
      }

      processNextBlock.call(this); // Initial call
    },
    fetchTransactionData(transactionId) {
      const requestConfigGetRawTransaction = {
        method: 'post',
        url: 'https://rpc.vrsc.komodefi.com',
        headers: { 'Content-Type': 'application/json' },
        data: { method: 'getrawtransaction', params: [], id: 1 }
      };

      requestConfigGetRawTransaction.data.params = [transactionId];
      return this.sendAxiosRequest(
        requestConfigGetRawTransaction.method,
        requestConfigGetRawTransaction.url,
        requestConfigGetRawTransaction.headers,
        requestConfigGetRawTransaction.data
      )
        .then((response) => {
          const requestConfigDecodeRawTransaction = {
            method: 'post',
            url: 'https://rpc.vrsc.komodefi.com/',
            headers: { 'Content-Type': 'application/json' },
            data: { method: 'decoderawtransaction', params: [], id: 1 }
          };
          requestConfigDecodeRawTransaction.data.params = [response.data.result];
          return this.sendAxiosRequest(
            requestConfigDecodeRawTransaction.method,
            requestConfigDecodeRawTransaction.url,
            requestConfigDecodeRawTransaction.headers,
            requestConfigDecodeRawTransaction.data
          ).then((response) => {
            return response.data.result;
          });
        });
    },
    processStakeBlock(block) {
      const transactions = block.tx;
      let coinbaseRewardAddress = null;
      let stakingAmount = null;

      transactions.forEach((transactionId) => {
        this.fetchTransactionData(transactionId)
          .then((transaction) => {
            if (!coinbaseRewardAddress) {
              const coinbaseReward = this.processTransactionCoinbase(transaction);
              if (coinbaseReward) {
                coinbaseRewardAddress = coinbaseReward.address;
              }
            }
          })
          .catch((error) => {
            console.error('Error fetching transaction data:', error);
          });
      });

      transactions.forEach((transactionId) => {
        this.fetchTransactionData(transactionId)
          .then((transaction) => {
            if (coinbaseRewardAddress) {
              const stakingReward = this.processTransactionStaking(
                transaction,
                coinbaseRewardAddress
              );
              if (stakingReward) {
                stakingAmount = stakingReward.amount;
                const newBlock = {
                  blockHeight: block.height,
                  blockHash: block.hash,
                  validationType: block.validationtype,
                  coinbaseRewardAddress: coinbaseRewardAddress,
                  stakingAmount: stakingAmount,
                  stakingAddress: stakingReward.address
                };
                this.blocks.push(newBlock);
              }
            }
          })
          .catch((error) => {
            console.error('Error fetching transaction data:', error);
          });
      });
    },
    processTransactionCoinbase(transaction) {
      const vin = transaction.vin;
      const vout = transaction.vout;
      const isCoinbase = vin.length === 1 && vin[0].coinbase;

      if (isCoinbase) {
        let coinbaseRewardAddress = '';
        if (
          vout[0].scriptPubKey.addresses[0] === 'RCG8KwJNDVwpUBcdoa6AoHqHVJsA1uMYMR'
        ) {
          coinbaseRewardAddress = vout[0].scriptPubKey.addresses[1];
        } else {
          coinbaseRewardAddress = vout[0].scriptPubKey.addresses[0];
        }
        return { address: coinbaseRewardAddress };
      }
      return null;
    },
    processTransactionStaking(transaction, coinbaseRewardAddress) {
      const vin = transaction.vin;
      const vout = transaction.vout;

      try {
        const matchingVin = vin.find((v) => v.address === coinbaseRewardAddress);
        const matchingVout = vout.find((v) =>
          v.scriptPubKey.addresses.includes(coinbaseRewardAddress)
        );

        if (matchingVin && matchingVout) {
          const stakingAmount = matchingVout.value;
          return { amount: stakingAmount, address: coinbaseRewardAddress };
        }
      } catch (error) {
        for (const vinEntry of vin) {
          for (const voutEntry of vout) {
            if (
              vinEntry.valueSat === voutEntry.valueSat &&
              vinEntry.addresses &&
              voutEntry.scriptPubKey.addresses &&
              vinEntry.addresses.length === 1 &&
              voutEntry.scriptPubKey.addresses.length === 1 &&
              vinEntry.addresses[0] === voutEntry.scriptPubKey.addresses[0]
            ) {
              return {
                amount: vinEntry.value,
                address: voutEntry.scriptPubKey.addresses[0]
              };
            }
          }
        }
      }
      return null;
    },
    sendAxiosRequest(method, url, headers, data) {
      return axios({
        method: method,
        url: url,
        headers: headers,
        data: data
      });
    }
  },
  mounted()
  {
    this.sendRequest();
  }
};
</script>
<style>
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

.card {
  padding: 2em;
}

#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}

</style>