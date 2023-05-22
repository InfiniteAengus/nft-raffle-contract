interface ConfigType {
  linkToken: string;
  vrfCoordinate: string;
  keyHash: string;
  fee: string;
}

export const chainlinkConfigs: Record<number, ConfigType> = {
  1: {
    linkToken: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    vrfCoordinate: "0xf0d54349aDdcf704F77AE15b96510dEA15cb7952",
    keyHash: "0xAA77729D3466CA35AE8D28B3BBAC7CC36A5031EFDC430821C02BC31A238AF445",
    fee: "2000000000000000000",
  },
  5: {
    linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
    vrfCoordinate: "0x2bce784e69d2Ff36c71edcB9F88358dB0DfB55b4",
    keyHash: "0x0476f9a745b61ea5c0ab224d3a6e4c99f0b02fce4da01143a4f70aa80ae76e8a",
    fee: "200000000000000000",
  },
  56: {
    linkToken: "0x404460C6A5EdE2D891e8297795264fDe62ADBB75",
    vrfCoordinate: "0x747973a5A2a4Ae1D3a8fDF5479f1514F65Db9C31",
    keyHash: "0xc251acd21ec4fb7f31bb8868288bfdbaeb4fbfec2df3735ddbd4f7dc8d60103c",
    fee: "200000000000000000",
  },
  97: {
    linkToken: "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06",
    vrfCoordinate: "0xa555fC018435bef5A13C6c6870a9d4C11DEC329C",
    keyHash: "0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186",
    fee: "100000000000000000",
  },
  80001: {
    linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
    vrfCoordinate: "0x8C7382F9D8f56b33781fE506E897a4F1e2d17255",
    keyHash: "0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4",
    fee: "100000000000000",
  },
};
