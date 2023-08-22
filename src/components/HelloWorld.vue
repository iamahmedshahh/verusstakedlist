<template>
  <div>
    <h1>Last 5 Blocks Data</h1>
    <p v-if="isLoading">Loading...</p>
    <v-table v-else>
      <thead>
        <tr>
          <th>Block Number</th>
          <th>Block Hash</th>
          <th>Staking address</th>
          <th>Amount Staked</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(block, index) in blocksData" :key="index">
          <td>
            <a :href="getBlockExplorerUrl(block.hash)" target="_blank">
              {{ block.number }}
            </a>
          </td>
          <td>{{ block.hash }}</td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script>
import axios from 'axios';
import { ref, onMounted } from 'vue';

export default {
  setup() {
    const isLoading = ref(true);
    const blocksData = ref([]);
    const numberOfBlocks = import.meta.env.VITE_APP_BLOCKS;

    const constructRpcRequest = (method, params = []) => {
      return {
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      };
    };

    const rpcRequest = async (method, params = []) => {
      const rpcUrl = 'http://135.181.184.116:2777'; // Change to your RPC URL
      const requestData = constructRpcRequest(method, params);

      try {
        const response = await axios.post(rpcUrl, requestData);
        return response.data.result;
      } catch (error) {
        console.error('Error sending RPC request:', error);
        return null;
      }
    };

    const getBlockExplorerUrl = (blockHash) => {
      return `https://first.sink.cakeshop.dev/api/block/${blockHash}`;
    };

    onMounted(async () => {
      try {
        const blocksValue = await rpcRequest('getblockcount');
        if (blocksValue !== null) {
          for (let i = 0; i < numberOfBlocks; i++) {
            const blockIndex = blocksValue - i;
            const blockHashValue = await rpcRequest('getblockhash', [blockIndex]);
            
            if (blockHashValue) {
              const blockDataValue = await rpcRequest('getblock', [blockHashValue]);
              if (blockDataValue !== null) {
                blocksData.value.push({
                  number: blockIndex,
                  hash: blockHashValue,
                  reward: blockDataValue.getblockreward
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error:', error);
      }
      isLoading.value = false;
    });

    return {
      isLoading,
      blocksData,
      numberOfBlocks,
      getBlockExplorerUrl,
    };
  },
};
</script>
