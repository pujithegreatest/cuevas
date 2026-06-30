import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
  Image,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { useAppStore } from "../state/appStore";
import { Ionicons } from "../components/Ionicons";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from "react-native-svg";
import { sharePngUriToInstagramStory } from "../utils/instagramStories";


type Props = NativeStackScreenProps<RootStackParamList, "StockBalance">;

interface PricePoint {
  date: string;
  price: number;
}

interface TokenData {
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  marketCap: number;
  volume24h: number;
  supply: number;
  priceHistory: PricePoint[];
}

export default function StockBalanceScreen({ navigation }: Props) {
  const viewShotRef = useRef<ViewShot>(null);
  const chartViewShotRef = useRef<ViewShot>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartImage, setChartImage] = useState<string | null>(null);

  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  const screenWidth = Dimensions.get("window").width;

  useEffect(() => {
    fetchTokenData();
  }, []);

  const generateMockData = (): TokenData => {
    const mockHistory: PricePoint[] = [];
    let basePrice = 0.0039;
    for (let i = 0; i < 30; i++) {
      const change = (Math.random() - 0.48) * 0.0003;
      basePrice = Math.max(0.003, Math.min(0.006, basePrice + change));
      mockHistory.push({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        price: basePrice,
      });
    }

    const latestPrice = mockHistory[mockHistory.length - 1].price;
    const yesterdayPrice = mockHistory[mockHistory.length - 2].price;
    const priceChange = latestPrice - yesterdayPrice;
    const priceChangePercent = (priceChange / yesterdayPrice) * 100;

    return {
      price: latestPrice,
      priceChange24h: priceChange,
      priceChangePercent24h: priceChangePercent,
      marketCap: 420000,
      volume24h: 12500,
      supply: 100000000,
      priceHistory: mockHistory,
    };
  };

  const fetchTokenData = async () => {
    try {
      setIsLoading(true);

      // Fetch BTC price as proxy for crypto market (Alpha Vantage)
      // DO NOT change this route - it goes through Vibecode proxy infrastructure
      const apiKey = process.env.EXPO_PUBLIC_VIBECODE_ALPHA_VANTAGE_API_KEY;
      
      if (!apiKey) {
        console.log("No API key, using mock data");
        setTokenData(generateMockData());
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD&apikey=${apiKey}`
      );

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();
      
      // Check for API error responses (rate limit, invalid key, etc.)
      if (data["Error Message"] || data["Note"] || data["Information"]) {
        console.log("API returned error/rate limit:", data["Note"] || data["Error Message"] || data["Information"]);
        throw new Error("API error or rate limited");
      }

      const timeSeries = data["Time Series (Digital Currency Daily)"];

      if (!timeSeries || Object.keys(timeSeries).length === 0) {
        throw new Error("No data available");
      }

      // Get last 30 days of price data
      const priceHistory: PricePoint[] = Object.entries(timeSeries)
        .slice(0, 30)
        .reverse()
        .map(([date, values]: [string, any]) => ({
          date,
          price: parseFloat(values["4a. close (USD)"]),
        }))
        .filter(p => !isNaN(p.price) && isFinite(p.price));

      if (priceHistory.length < 2) {
        throw new Error("Insufficient price data");
      }

      const latestPrice = priceHistory[priceHistory.length - 1].price;
      const yesterdayPrice = priceHistory[priceHistory.length - 2].price;
      const priceChange = latestPrice - yesterdayPrice;
      const priceChangePercent = (priceChange / yesterdayPrice) * 100;

      // Scale down to match Cuevas coin price range
      const scaleFactor = 0.0000001;
      setTokenData({
        price: latestPrice * scaleFactor,
        priceChange24h: priceChange * scaleFactor,
        priceChangePercent24h: isNaN(priceChangePercent) ? 0 : priceChangePercent,
        marketCap: 420000,
        volume24h: 12500,
        supply: 100000000,
        priceHistory: priceHistory.map((p) => ({
          ...p,
          price: p.price * scaleFactor,
        })),
      });
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      // API failed, use mock data
      console.log("Using mock data for chart:", err);
      setTokenData(generateMockData());
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTokenData();
  };

  const captureChart = async (): Promise<string | null> => {
    if (chartViewShotRef.current && chartViewShotRef.current.capture) {
      try {
        const uri = await chartViewShotRef.current.capture();
        return uri;
      } catch (error) {
        return null;
      }
    }
    return null;
  };

  const handleExport = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        return;
      }

      // First capture the chart
      const chartUri = await captureChart();
      setChartImage(chartUri);

      // Wait a moment for the state to update
      setTimeout(async () => {
        if (viewShotRef.current && viewShotRef.current.capture) {
          const uri = await viewShotRef.current.capture();

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: "image/png",
              dialogTitle: "Share Stock Balance",
            });
          } else {
            await MediaLibrary.createAssetAsync(uri);
          }
        }
        setChartImage(null);
      }, 100);
    } catch (error) {
      // Silently handle export errors
      setChartImage(null);
    }
  };

  const handleShareToInstagramStory = async () => {
    try {
      // Capture chart into chartImage first so the export canvas includes it (same as handleExport).
      const chartUri = await captureChart();
      setChartImage(chartUri);

      setTimeout(async () => {
        try {
          if (viewShotRef.current && viewShotRef.current.capture) {
            const uri = await viewShotRef.current.capture();
            const ok = await sharePngUriToInstagramStory(uri, {
              debugTag: "STOCK",
              attributionURL: "https://www.ecothot.com/",
            });
            if (!ok && (await Sharing.isAvailableAsync())) {
              await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share Stock Balance" });
            }
          }
        } finally {
          setChartImage(null);
        }
      }, 100);
    } catch (e) {
      setChartImage(null);
      console.log("[STOCK] IG story share failed", String((e as any)?.message || e));
    }
  };

  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(decimals)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(decimals)}K`;
    }
    return `$${num.toFixed(decimals)}`;
  };

  const formatPrice = (price: number): string => {
    if (isNaN(price) || !isFinite(price)) {
      return "$0.00";
    }
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const isPositive = tokenData ? tokenData.priceChange24h >= 0 : true;

  // Render chart as SVG with gradient fill (iOS Stocks style)
  const renderChart = (data: PricePoint[]) => {
    if (!data || data.length < 2) {
      return null;
    }

    const chartWidth = screenWidth - 80;
    const chartHeight = 200;
    const padding = 20;

    // Force convert all prices to valid numbers
    const prices = data.map((p) => {
      const price = typeof p?.price === "number" ? p.price : parseFloat(String(p?.price || 0));
      return isNaN(price) ? 0.004 : price; // Default fallback price
    });

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = Math.max(maxPrice - minPrice, 0.0001);

    // Generate points
    const points = prices.map((price, i) => {
      const x = padding + (i / (prices.length - 1)) * (chartWidth - padding * 2);
      const y = padding + (chartHeight - padding * 2) * (1 - (price - minPrice) / priceRange);
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(" L ")}`;
    const lineColor = isDarkMode ? "#06A7A1" : "#70A780";

    return (
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        {/* Area fill */}
        <Path
          d={`${pathData} L ${chartWidth - padding},${chartHeight - padding} L ${padding},${chartHeight - padding} Z`}
          fill="url(#grad)"
        />
        {/* Line */}
        <Path
          d={pathData}
          stroke={lineColor}
          strokeWidth="2.5"
          fill="none"
        />
      </Svg>
    );
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ["#1a1a1a", "#0a0a0a"] : ["#CFEFEC", "#A8D5D3"]}
      style={{ flex: 1 }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center px-6 pt-14 pb-4">
        <Pressable
          onPress={() => navigation.goBack()}
          className="p-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? "#CFEFEC" : "#80171F"}
          />
        </Pressable>

        <Text
          className={`text-2xl font-bold ${
            isDarkMode ? "text-dark-text" : "text-pixel-text"
          }`}
        >
          Cuevas Stock
        </Text>

        <Pressable
          onPress={toggleDarkMode}
          className="p-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons
            name={isDarkMode ? "sunny" : "moon"}
            size={24}
            color={isDarkMode ? "#CFEFEC" : "#80171F"}
          />
        </Pressable>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator
            size="large"
            color={isDarkMode ? "#06A7A1" : "#2584BC"}
          />
          <Text
            className={`mt-4 ${
              isDarkMode ? "text-dark-text" : "text-pixel-black"
            }`}
          >
            Loading stock data...
          </Text>
        </View>
      )}

      {/* Stock Data */}
      {!isLoading && tokenData && (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={isDarkMode ? "#06A7A1" : "#2584BC"}
              colors={["#06A7A1"]}
            />
          }
        >
          <View className="px-6">
            {/* Price Card */}
            <View
              className={`rounded-3xl p-6 mb-6 ${
                isDarkMode ? "bg-dark-surface" : "bg-white"
              }`}
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 5,
              }}
            >
              <Text
                className={`text-sm mb-2 uppercase tracking-wider ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Current Price
              </Text>
              <Text
                className={`text-5xl font-bold mb-2 ${
                  isDarkMode ? "text-dark-text" : "text-pixel-text"
                }`}
              >
                {formatPrice(tokenData.price)}
              </Text>
              <View className="flex-row items-center">
                <Ionicons
                  name={isPositive ? "trending-up" : "trending-down"}
                  size={20}
                  color={isPositive ? "#70A780" : "#80171F"}
                />
                <Text
                  className="text-lg ml-2 font-bold"
                  style={{
                    color: isPositive ? "#70A780" : "#80171F",
                  }}
                >
                  {isPositive ? "+" : ""}
                  {isNaN(tokenData.priceChangePercent24h) ? "0.00" : tokenData.priceChangePercent24h.toFixed(2)}% (24h)
                </Text>
              </View>
            </View>

            {/* Price Chart - Full Width */}
            {tokenData.priceHistory && tokenData.priceHistory.length >= 2 && (
              <View
                className={`rounded-3xl overflow-hidden mb-6 ${
                  isDarkMode ? "bg-dark-surface" : "bg-white"
                }`}
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 5,
                }}
              >
                <View className="p-4 pb-2">
                  <Text
                    className={`text-sm mb-2 uppercase tracking-wider ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    30-Day Price Chart
                  </Text>
                </View>
                <ViewShot
                  ref={chartViewShotRef}
                  options={{ format: "png", quality: 1.0, result: "tmpfile" }}
                  style={{ backgroundColor: "transparent", height: 280 }}
                >
                  <View style={{ height: 240, paddingHorizontal: 16, paddingBottom: 16, alignItems: "center", justifyContent: "center" }}>
                    {tokenData.priceHistory && tokenData.priceHistory.length >= 2 ? (
                      renderChart(tokenData.priceHistory)
                    ) : (
                      <View style={{ height: 200, justifyContent: "center", alignItems: "center" }}>
                        <Text className={isDarkMode ? "text-dark-text" : "text-pixel-black"}>
                          No chart data available
                        </Text>
                      </View>
                    )}
                  </View>
                </ViewShot>
              </View>
            )}

            {/* Stats Grid */}
            <View className="flex-row flex-wrap gap-3 mb-6">
              {/* Market Cap */}
              <View
                className={`flex-1 rounded-2xl p-4 ${
                  isDarkMode ? "bg-dark-surface" : "bg-white"
                }`}
                style={{
                  minWidth: "47%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text
                  className={`text-xs mb-2 uppercase tracking-wider ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Market Cap
                </Text>
                <Text
                  className={`text-xl font-bold ${
                    isDarkMode ? "text-dark-text" : "text-pixel-teal"
                  }`}
                >
                  {formatNumber(tokenData.marketCap)}
                </Text>
              </View>

              {/* Volume 24h */}
              <View
                className={`flex-1 rounded-2xl p-4 ${
                  isDarkMode ? "bg-dark-surface" : "bg-white"
                }`}
                style={{
                  minWidth: "47%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text
                  className={`text-xs mb-2 uppercase tracking-wider ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Volume 24H
                </Text>
                <Text
                  className={`text-xl font-bold ${
                    isDarkMode ? "text-dark-text" : "text-pixel-blue"
                  }`}
                >
                  {formatNumber(tokenData.volume24h)}
                </Text>
              </View>

              {/* Supply */}
              <View
                className={`flex-1 rounded-2xl p-4 ${
                  isDarkMode ? "bg-dark-surface" : "bg-white"
                }`}
                style={{
                  minWidth: "47%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text
                  className={`text-xs mb-2 uppercase tracking-wider ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Supply
                </Text>
                <Text
                  className={`text-xl font-bold ${
                    isDarkMode ? "text-dark-text" : "text-pixel-green"
                  }`}
                >
                  {formatNumber(tokenData.supply, 0)}
                </Text>
              </View>

              {/* 24h Change */}
              <View
                className={`flex-1 rounded-2xl p-4 ${
                  isDarkMode ? "bg-dark-surface" : "bg-white"
                }`}
                style={{
                  minWidth: "47%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text
                  className={`text-xs mb-2 uppercase tracking-wider ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  24H Change
                </Text>
                <Text
                  className="text-xl font-bold"
                  style={{
                    color: isPositive ? "#70A780" : "#80171F",
                  }}
                >
                  {formatPrice(Math.abs(tokenData.priceChange24h))}
                </Text>
              </View>
            </View>

            {/* Export Button */}
            <Pressable
              onPress={handleExport}
              className={`mb-6 py-4 rounded-full ${
                isDarkMode ? "bg-dark-accent" : "bg-pixel-teal"
              }`}
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 3,
              })}
            >
              <Text
                className="text-base font-semibold text-center"
                style={{ color: isDarkMode ? "#FFFFFF" : "#10252B" }}
              >
                Save as PNG
              </Text>
            </Pressable>

            {/* Share to Instagram Stories (new, does not change Export) */}
            <Pressable
              onPress={handleShareToInstagramStory}
              className={`mb-6 py-4 rounded-full border ${
                isDarkMode ? "border-gray-700 bg-dark-surface" : "border-gray-200 bg-white"
              }`}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="logo-instagram" size={20} color={isDarkMode ? "#CFEFEC" : "#1F2937"} />
                <Text className={`ml-2 text-base font-semibold ${isDarkMode ? "text-dark-text" : "text-pixel-text"}`}>
                  Share to IG Story
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Hidden ViewShot for Instagram export */}
          <View style={{ position: "absolute", left: -9999 }}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: "png", quality: 1.0, result: "tmpfile" }}
              style={{
                width: 1080,
                height: 1920,
                backgroundColor: isDarkMode ? "#1a1a1a" : "#CFEFEC",
                alignItems: "center",
                justifyContent: "center",
                padding: 60,
              }}
            >
              <View style={{ alignItems: "center", width: "100%" }}>
                {/* Coin Logo */}
                <Image
                  source={require("../../assets/image-1764330193.png")}
                  style={{ width: 200, height: 200, marginBottom: 40 }}
                  resizeMode="contain"
                />

                <Text
                  style={{
                    fontSize: 32,
                    color: isDarkMode ? "#CFEFEC" : "#3D3737",
                    marginBottom: 20,
                  }}
                >
                  CUEVAS STOCK
                </Text>

                <Text
                  style={{
                    fontSize: 100,
                    fontWeight: "bold",
                    color: isDarkMode ? "#06A7A1" : "#80171F",
                    marginBottom: 10,
                  }}
                >
                  {formatPrice(tokenData.price)}
                </Text>

                <Text
                  style={{
                    fontSize: 40,
                    fontWeight: "bold",
                    color: isPositive ? "#70A780" : "#80171F",
                    marginBottom: 60,
                  }}
                >
                  {isPositive ? "+" : ""}
                  {isNaN(tokenData.priceChangePercent24h) ? "0.00" : tokenData.priceChangePercent24h.toFixed(2)}%
                </Text>

                {/* Chart Image */}
                {chartImage && (
                  <Image
                    source={{ uri: chartImage }}
                    style={{
                      width: 900,
                      height: 450,
                      marginBottom: 60,
                      borderRadius: 24,
                    }}
                    resizeMode="contain"
                  />
                )}

                <Text
                  style={{
                    fontSize: 28,
                    color: isDarkMode ? "#CFEFEC" : "#3D3737",
                    marginBottom: 10,
                  }}
                >
                  Market Cap: {formatNumber(tokenData.marketCap)}
                </Text>
                <Text
                  style={{
                    fontSize: 28,
                    color: isDarkMode ? "#CFEFEC" : "#3D3737",
                    marginBottom: 60,
                  }}
                >
                  Volume: {formatNumber(tokenData.volume24h)}
                </Text>

                <Text
                  style={{
                    fontSize: 24,
                    color: isDarkMode ? "#06A7A1" : "#3D3737",
                    marginTop: 40,
                  }}
                >
                  apps by ecothot
                </Text>
              </View>
            </ViewShot>
          </View>
        </ScrollView>
      )}

    </LinearGradient>
  );
}
