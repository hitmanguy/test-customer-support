'use client';

import { Box, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Bot3D = () => {
  const theme = useTheme();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        height: '500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1000px',
        position: 'relative',
      }}
    >
      {}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            borderRadius: '50%',
            filter: 'blur(1px)',
          }}
          animate={{
            x: [0, 50, -50, 0],
            y: [0, -50, 50, 0],
            opacity: [0.2, 1, 0.2],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            delay: i * 0.5,
          }}
          initial={{
            left: `${20 + i * 10}%`,
            top: `${20 + i * 15}%`,
          }}
        />
      ))}

      {}
      <motion.div
        animate={{
          rotateY: mousePosition.x,
          rotateX: -mousePosition.y,
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        style={{
          transformStyle: 'preserve-3d',
          position: 'relative',
        }}
      >
        {}
        <motion.div
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            width: '200px',
            height: '280px',
            position: 'relative',
            transformStyle: 'preserve-3d',
          }}
        >
          {}
          <Box
            sx={{
              width: '120px',
              height: '120px',
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              borderRadius: '20px',
              position: 'absolute',
              top: '0',
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: `0 10px 30px rgba(124, 58, 237, 0.3)`,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '20px',
                left: '20px',
                width: '80px',
                height: '80px',
                background: `linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.3))`,
                borderRadius: '15px',
                backdropFilter: 'blur(10px)',
              },
            }}
          >
            {}
            <Box sx={{ display: 'flex', gap: '20px', justifyContent: 'center', mt: 3 }}>
              {[0, 1].map((eye) => (
                <motion.div
                  key={eye}
                  animate={{
                    scaleY: [1, 0.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: eye * 0.1,
                  }}
                  style={{
                    width: '12px',
                    height: '12px',
                    background: '#ffffff',
                    borderRadius: '50%',
                    boxShadow: `0 0 10px rgba(255,255,255,0.8)`,
                  }}
                />
              ))}
            </Box>
            
            {}
            <motion.div
              animate={{
                width: ['20px', '30px', '20px'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              style={{
                position: 'absolute',
                bottom: '25px',
                left: '50%',
                transform: 'translateX(-50%)',
                height: '8px',
                background: '#ffffff',
                borderRadius: '10px',
              }}
            />
          </Box>

          {}
          <Box
            sx={{
              width: '160px',
              height: '120px',
              background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
              borderRadius: '15px',
              position: 'absolute',
              top: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: `0 10px 30px rgba(16, 185, 129, 0.3)`,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '15px',
                left: '15px',
                width: '130px',
                height: '90px',
                background: `linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.2))`,
                borderRadius: '10px',
                backdropFilter: 'blur(5px)',
              },
            }}
          >
            {}
            <Box
              sx={{
                position: 'absolute',
                top: '30px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80px',
                height: '60px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  style={{
                    width: '40px',
                    height: '4px',
                    background: '#ffffff',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </Box>
          </Box>

          {}
          {[-1, 1].map((side) => (
            <motion.div
              key={side}
              animate={{
                rotate: [0, side * 10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: side === 1 ? 0.5 : 0,
              }}
              style={{
                position: 'absolute',
                top: '120px',
                [side === -1 ? 'left' : 'right']: '-20px',
                width: '20px',
                height: '80px',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                borderRadius: '10px',
                transformOrigin: 'top center',
                boxShadow: `0 5px 15px rgba(124, 58, 237, 0.2)`,
              }}
            />
          ))}

          {}
          <Box
            sx={{
              width: '100px',
              height: '40px',
              background: `linear-gradient(135deg, ${theme.palette.grey[300]}, ${theme.palette.grey[500]})`,
              borderRadius: '50px',
              position: 'absolute',
              bottom: '-20px',
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: `0 5px 20px rgba(0,0,0,0.2)`,
            }}
          />
        </motion.div>

        {}
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '300px',
            border: `2px solid ${theme.palette.primary.main}`,
            borderRadius: '50%',
            opacity: 0.3,
            background: `conic-gradient(from 0deg, transparent 70%, ${theme.palette.primary.main} 100%)`,
          }}
        />

        {}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
          style={{
            position: 'absolute',
            top: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '20px',
            height: '20px',
            background: `radial-gradient(circle, ${theme.palette.secondary.main}, transparent)`,
            borderRadius: '50%',
            filter: 'blur(2px)',
          }}
        />
      </motion.div>
    </Box>
  );
};
