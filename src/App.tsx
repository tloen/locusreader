import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import _ from "lodash";
import { Navbar, Alignment, ProgressBar } from "@blueprintjs/core";
import { Document, Page, pdfjs } from "react-pdf";
import { GlobalHotKeys } from "react-hotkeys";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const apiKey = process.env.REACT_APP_API_KEY;
const origin = process.env.REACT_APP_ORIGIN;
const destination = process.env.REACT_APP_DESTINATION;
const pdfPath = process.env.REACT_APP_PATH;

const getRoute = async () => {
  const { google } = window;
  const result = await new Promise<google.maps.DirectionsResult>(
    (resolve, _reject) => {
      new google.maps.DirectionsService().route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, _status) => {
          resolve(result);
        }
      );
    }
  );
  const [route] = result.routes;
  const vertices = _(route.legs)
    .map((leg) => leg.steps)
    .flatten()
    .map((step) => step.path)
    .flatten()
    .value();
  return vertices;
};

function toRadians(deg: number) {
  return deg * (Math.PI / 180);
}

function bearingTo(ls: google.maps.LatLng, ll: google.maps.LatLng) {
  var lat1 = toRadians(ls.lat()),
    lat2 = toRadians(ll.lat()),
    dLon = toRadians(ll.lng()) - toRadians(ls.lng());
  return (
    ((Math.atan2(
      Math.sin(dLon) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}

export interface LocusReaderHotkeysProps {
  nextPage: () => void;
  prevPage: () => void;
}

function App() {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [vertices, setVertices] = useState<google.maps.LatLng[]>();
  const [index, setIndex] = useState<number>(1);
  const [debouncedIndex, setDebouncedIndex] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);

  const updateDebouncedIndex = useRef(_.throttle(setDebouncedIndex, 500));

  useEffect(() => {
    updateDebouncedIndex.current(index);
  }, [index]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    // script.async = true;
    document.body.appendChild(script);
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setVertices(await getRoute());
      forceUpdate();
    })();
    return () => {
      document.body.removeChild(script);
    };
  }, [forceUpdate]);

  const { google } = window;
  if (!google) return <p>Loading Google API...</p>;
  if (!vertices) return <p>Loading directions...</p>;
  const progress =
    numPages && Math.ceil((vertices.length * (debouncedIndex - 1)) / numPages);
  console.log(index, debouncedIndex, progress);
  const [v1, v2] = [vertices[progress], vertices[progress + 1]];
  const bearing = bearingTo(v1, v2);
  const handlers = {
    PREV_PAGE: () => {
      if (index > 1) setIndex(index - 1);
    },
    NEXT_PAGE: () => {
      if (index < numPages) setIndex(index + 1);
    },
  };
  return (
    <>
      <GlobalHotKeys
        keyMap={{
          PREV_PAGE: [",", "left"],
          NEXT_PAGE: [".", "right"],
        }}
        handlers={handlers}
        allowChanges
      />
      <Navbar fixedToTop>
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>LocusReader</Navbar.Heading>
          <Navbar.Divider />
          <Navbar.Heading className="page-number">
            Page {index} of {numPages}
          </Navbar.Heading>
          <Navbar.Heading>
            <ProgressBar stripes={false} value={numPages && index / numPages} />
          </Navbar.Heading>
        </Navbar.Group>
      </Navbar>
      <div
        className="App"
        style={{
          backgroundImage: `url("https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${v1.lat()},${v2.lng()}&heading=${bearing}&pitch=0&key=${apiKey}")`,
          backgroundSize: "cover",
        }}
      >
        <div className="blur">
          <Document
            className="document"
            file={pdfPath}
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages);
            }}
          >
            <Page
              className="page"
              height={window.innerHeight * 0.8}
              pageNumber={debouncedIndex}
            />
          </Document>
        </div>
      </div>
    </>
  );
}

export default App;
